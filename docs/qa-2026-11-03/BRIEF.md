# Briefing comum — QA Judeu/Ajuda+ (3 personas)

Repo: /Users/jvsen/Desktop/jobs/projects/mobile/judeu (backend Next.js em apps/web, app Expo em apps/native).
Scratch QA: /private/tmp/claude-501/-Users-jvsen-Desktop-jobs-projects-mobile-judeu/eda8797b-ed67-44d4-87dd-774c818dab53/scratchpad/qa  (chame de $QA)

## Infra já no ar (NÃO reinicie nada)
- Backend: http://localhost:3001 (logs em $QA/../backend.log — pode ler para ver stack traces de 500).
- Metro: porta 8081 (CI mode) · Simulador iPhone 18 Pro UDID B45B6EB5-FED0-475A-A03D-723A427F6148 com app com.judeu.app instalado, GPS fixado em Palmas (-10.2317,-48.3242).
- Maestro: ~/.maestro/bin/maestro --device B45B6EB5-FED0-475A-A03D-723A427F6148 test <flow.yaml>  (rode a partir de $QA/maestro; screenshots com `takeScreenshot: shots/<persona>-<tela>`). Não há testID → use texto pt-BR, `point: "x%,y%"` como fallback. Para mover o GPS: `xcrun simctl location booted set <lat>,<lng>`. Screenshot avulso: `xcrun simctl io booted screenshot <arquivo.png>` e leia o PNG com a ferramenta Read para enxergar a tela.
- Hierarquia da tela (para achar textos): `~/.maestro/bin/maestro --device <UDID> hierarchy` .

## Helpers
- API: `$QA/api.sh <METHOD> </api/...> ['json'] [token]` → imprime corpo + `HTTP <code> <tempo>`.
- Banco (service role, PostgREST): `node $QA/db.mjs q <tabela> '{"col":"v"}' 'cols'` | `count` | `update <tabela> '{filtro}' '{set}'` | `insert <tabela> '<json|array>'` | `del`. Filtro: valor normal = eq; array = in; null = is null; "like:qa-%" = like. Tabelas minúsculas: user, providerprofile, providercategory, service, category, address, order, orderevent, orderproposal, message, review, payment, wallet, wallettransaction, notification, supportticket, jobposting, jobshift, jobapplication, refreshtoken. Inserts exigem id (uuid), createdAt, updatedAt (onde existir) em ISO.
- Contexto compartilhado: $QA/context.json (contas de apoio, ids de categoria). Adicione as contas que criar (chave `personas.<persona>`), sem apagar o resto.

## Regras de ouro
1. Sempre registre evidência: comando + resposta resumida (código HTTP e campo relevante), ou arquivo:linha do código, ou screenshot.
2. Cada achado: Título · Severidade (Crítico/Alto/Médio/Baixo) · Perfil afetado · Rodada · Evidência · Impacto para o usuário · Sugestão de correção (lógica/regra/tela).
3. Anote também o que FUNCIONOU bem (para o relatório ser justo) e o que é CONFUSO mesmo sem ser bug (texto, navegação, expectativa quebrada).
4. Não altere código do repo. Não apague dados que não sejam seus. Prefixo de tudo que criar: qa-20261103-.
5. Bug já conhecido: POST /api/providers/me → 500 "operator does not exist: text = uuid" (RPC replace_provider_categories_services declara uuid, colunas são text). Perfil é atualizado antes do RPC, mas categorias/serviços NÃO são salvos. Se precisar, insira providercategory/service direto no banco e registre o impacto no primeiro acesso.
6. Token JWT dura 15 min e carrega o role: após virar helper use os tokens novos; renove com POST /api/auth/refresh {refreshToken}.

## Simulador = recurso único (lock)
Antes de usar Maestro/simulador: crie $QA/mailbox/UI-lock com seu nome se não existir (`set -o noclobber; echo persona > $QA/mailbox/UI-lock`); se existir, espere (loop com sleep 20, até 15 min) e tente de novo. Ao terminar sua sessão de UI, faça logout no app (Perfil → "Sair da conta") e apague o lock. Mantenha sessões de UI curtas (uma jornada por vez) e devolva o lock entre jornadas.

## Mailbox entre agentes (cenários cruzados)
Arquivos JSON em $QA/mailbox/ nomeados `S<n>-<passo>-<quem>.json` com {orderId, proposalId, status, obs, at}. Quem depende de um passo espera o arquivo (loop `until [ -f ... ]; do sleep 10; done` com limite de 10 min; se estourar, registre "bloqueado: esperando X" e siga para o próximo item). Escreva também `S<n>-done-<quem>.json` ao concluir seu lado.

## API — resumo (detalhes em apps/web/src/app/api/** e apps/web/src/lib/*.ts)
- Auth: POST /api/auth/register {fullName,email,password(8+),phone?,role? CLIENT|PROVIDER|BOTH,acceptedTerms:true} → 201 {user,accessToken,refreshToken}; /login; /refresh; /logout; /forgot-password; /reset-password {email,code:"123456",newPassword}; GET/PATCH/DELETE /api/auth/me; /me/avatar; /me/export; /me/stats.
- Endereços: GET/POST /api/addresses {street,city,state(2),cep?,number?,neighborhood?,lat?,lng?,isDefault?,label?}; PATCH/DELETE /api/addresses/:id; POST /:id/default.
- Catálogo: GET /api/categories; GET /api/providers?categoryId=; GET /api/providers/:id; GET /api/providers/:id/reviews; GET /api/search?q=; GET /api/providers/nearby?lat&lng&categoryId?
- Perfil de quem atende: GET/POST /api/providers/me (upsert KYC — bug 500); POST /me/document {base64,mimeType}; POST /me/availability {isAvailable}; POST /me/location {lat,lng}; POST /me/helper {fullName,phone,bio?,acceptedTerms:true,lat?,lng?} (vira BOTH + isHelper + APPROVED; devolve tokens novos); PATCH /me/helper {bio?,serviceRadiusKm?}.
- Pedidos: POST /api/orders {providerId?,serviceId?,categoryId?,description?,scheduledAt?,addressId?,pickupAddressId?,priceCents?} (sem providerId = ajuda aberta: description≥8, priceCents≥100); GET /api/orders?as=client|provider; GET /api/orders/:id; POST /:id/transition {action: accept|reject|start_route|start_work|complete|confirm_completion|cancel, note?}; POST /:id/location {lat,lng}; PATCH /:id/arrange {addressId?,pickupAddressId?,detailsReady?}; POST /:id/reassign {providerId}.
  Regras: start_route exige pagamento PAID ou CASH; start_work exige última localização ≤150 m do destino; complete → AWAITING_CONFIRMATION; confirm_completion (cliente) → COMPLETED e credita priceCents na carteira; cancel só cliente em CREATED/ACCEPTED; reject só em chamada direta.
- Propostas: GET/POST /api/orders/:id/proposals {priceCents≥100,note?}; POST /:id/proposals/:pid/respond {action: accept|reject}. Profissional: só CREATED + allowsNegotiation + sem payment. Ajuda aberta: só ACCEPTED, só cliente propõe, aceite bilateral (cliente primeiro, depois quem atende).
- Pagamento: POST /api/orders/:id/payment {method: PIX|CARD|CASH}; GET idem; POST /:id/payment/confirm.
- Chat: GET/POST /api/orders/:id/messages {body}. Avaliação: GET/POST /api/orders/:id/review {rating 1-5, comment?} (só COMPLETED). Carteira: GET /api/wallet.
- Notificações: GET /api/notifications; POST /:id/read; POST /read-all; GET/POST /preferences {notifyOrders?,notifyMessages?}. Push: POST /api/push-token.
- Suporte: GET/POST /api/support/tickets {category PAYMENT|CANCELLATION|SECURITY|ACCOUNT|DISPUTE|OTHER, subject(3-120), message(10-2000), orderId?}; GET /:id.
- Vagas: GET /api/jobs?categoryId&contractType&q; GET /api/jobs/:id; POST /api/jobs/:id/apply {message?}; GET /api/jobs/applications; GET/POST /api/jobs/me {categoryId,title,description,contractType CLT|PJ|FREELANCE|TEMPORARY,salaryCents?,shifts:[{weekday MONDAY..,startTime "HH:mm",endTime}]}; GET/PATCH /api/jobs/me/:id {status OPEN|CLOSED}; GET /me/:id/applicants; POST /me/:id/applicants/:aid/respond {action}.
- Admin (simular via db.mjs): aprovar KYC = update providerprofile {userId} {"status":"APPROVED","documentUrl":"qa/fake.jpg"}; responder chamado = update supportticket {id} {"adminResponse":"...","status":"RESOLVED","resolvedAt":"<iso>"}.

## Telas (apps/native) — onde olhar
app/index.tsx (onboarding) · app/(auth)/{login,signup,forgot-password,reset-password,otp}.tsx · app/client/(tabs)/{index,orders,earnings,profile,_layout}.tsx · app/client/{create-order,waiting/[id],payment/[id],order/[id],tracking/[id],chat/[id],propose/[id],rating/[id],attend/[id],attend-rating/[id],arrange/[id],helper-signup,helper-profile,kyc,notifications,support,support-ticket-new,support-ticket/[id],privacy,edit-profile,addresses,address-form,provider/[id],ai/chat}.tsx · app/client/vaga/** · app/jobs/** · components/screens/*.tsx · components/{help-sheet,help-ask-button,attend-turn-on,attend-radar,chat-price-panel}.tsx · lib/{work-mode,incoming-work,attend-button,nearby,notifications,format,hooks,api}.ts

## Maestro — lições já aprendidas (siga)
- iOS funde os textos filhos de um Pressable num único rótulo: use regex: `tapOn: ".*Quero contratar.*"`, `assertVisible: ".*Entrar.*"`, `extendedWaitUntil: {visible: ".*Palmas.*", timeout: 30000}`.
- Elementos sem texto (avatar da home, ícones) só por `point: "x%,y%"`; avatar da home ≈ "9%,10%"; sino ≈ "90%,10%" (CUIDADO: o botão flutuante cinza "Dev tools" do dev client fica em cima do sino — se tocar nele abre o menu de dev; feche com "Continue"/X).
- A árvore de acessibilidade às vezes falha no mapa (kAXErrorInvalidUIElement) → o comando falha; repita o flow (`maestro test` de novo) e use `waitForAnimationToEnd`/`extendedWaitUntil` antes de asserts. Cada comando do Maestro leva alguns segundos; mantenha flows curtos (≤ 12 passos) e use `optional: true` em permissões.
- Permissões do sistema (localização/notificações/fotos): `- tapOn: {text: "Allow.*|Permitir.*", optional: true}`; o simulador está em inglês.
- Digitar: `tapOn: ".*E-mail.*"` + `inputText: "..."`; esconder teclado com `hideKeyboard`. Para ver a tela: `takeScreenshot` ou `xcrun simctl io booted screenshot x.png` + Read.
- Se o app estiver numa tela de erro vermelha/"problem loading": `xcrun simctl openurl booted "exp+judeu://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"`.
- Ao concluir sua sessão de UI, faça logout (Perfil → "Sair da conta") para a próxima persona; se não conseguir pela UI: `xcrun simctl terminate booted com.judeu.app; xcrun simctl uninstall booted com.judeu.app; xcrun simctl keychain booted reset; xcrun simctl install booted /Users/jvsen/Library/Developer/Xcode/DerivedData/Judeu-amnxakmqlrugotejgyfhzqnaqerj/Build/Products/Debug-iphonesimulator/Judeu.app; xcrun simctl location booted set -10.2317,-48.3242;` e reabra pela URL acima.
