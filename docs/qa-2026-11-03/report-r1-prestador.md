# Relatório QA — Rodada 1 (primeiro acesso) — Persona PRESTADOR PROFISSIONAL (com KYC)

Data: 2026-11-03 · Conta API: qa-20261103-novo-prestador@teste.app (userId 07b9e2e9-648e-45dc-98af-e1b6bb20597f, providerProfileId 852f3a4a-bbd8-40c0-a93e-406787f27815) · Conta UI: qa-20261103-ui-prestador@teste.app (userId e330d450-2d5f-4daa-98be-fa7497777fac, providerProfileId a006f42c-699d-4bf9-8616-00d67c9e3cde).
Evidências: comandos via `$QA/api.sh` / `$QA/db.mjs`, código em `apps/web/src` e `apps/native`, screenshots em `$QA/maestro/shots/prestador-*.png`, flows em `$QA/maestro/prestador-*.yaml`.

## 1. Jornada de primeiro acesso (10 linhas)

1. Onboarding "Quero trabalhar" → cadastro com o mesmo formulário do cliente (nada diz que é conta de trabalho) → `register` 201 cria `user` PROVIDER **e já cria uma linha `providerprofile` vazia** (register/route.ts:58).
2. Por isso o KYC abre, na primeira vez, com chip "Em análise" e botão "Atualizar cadastro" (shots/prestador-04-kyc-topo.png) — o novato acha que já está em análise antes de preencher.
3. Preenche categoria (só 1), "O que você faz", experiência, raio (aceita 0), serviços, negociação, foto do documento (card diz "Documento enviado" — ainda não foi).
4. Toca "Enviar/Atualizar cadastro" → `POST /api/providers/me` → **HTTP 500 corpo vazio** (RPC `replace_provider_categories_services`, text=uuid) → toast **"Erro 500"** (shots/prestador-20-kyc-submit-t1.png).
5. No banco ficou headline/bio/experiência/raio/negociação; **categorias, serviços e documento NÃO** (o upload roda depois do POST, kyc.tsx:167-185). Ninguém avisa.
6. Fecha e reabre: cai no mapa do cliente com botão verde "Pronto para ajudar?" (vocabulário de helper); nada lembra que o cadastro está incompleto (shots/prestador-21-reabrir.png).
7. Perfil mostra "● Cadastro em análise"; toggle "Receber chamadas" visível mas toca → toast "Cadastro em análise — Assim que for aprovado…". Sem prazo, sem canal, sem notificação de aprovação.
8. Aprovação só existe no painel web `apps/web/src/app/admin` (senha única `ADMIN_PASSWORD`) — **nenhum caminho dentro do app**; simulada via `db.mjs update providerprofile status APPROVED`.
9. Aprovado: chip "● Verificado", toggle liga ("Disponível para chamadas"), GPS enviado; chamada direta aparece como pin "Chamada para você / 1 no mapa" (sem CTA) → HelpSheet com Aceitar/Recusar/Propor → Aceitar → tela attend "Aguardando pagamento".
10. Caminho feliz por API funcionou de ponta a ponta (accept → chat → start_route com CASH → start_work a ≤150 m → complete → cliente confirma → carteira +R$80 → avaliações).

## 2. Tabela de achados

| ID | Título | Sev. | Evidência | Impacto | Sugestão |
|---|---|---|---|---|---|
| P-01 | KYC não conclui: POST /providers/me → 500 e toast "Erro 500" | **Crítico** | `api.sh POST /api/providers/me` → `HTTP 500` corpo vazio; backend.log: `operator does not exist: text = uuid` em provider-profile.ts:146; route.ts:52-64 sem try/catch; lib/api.ts:44-47 transforma em "Erro 500" (shots/prestador-20) | Nenhum prestador novo consegue se cadastrar; categorias/serviços nunca salvam; usuário não entende o erro | Corrigir tipos da RPC (text vs uuid); try/catch na rota com mensagem; tela deve explicar o que falhou |
| P-02 | Estado meio-salvo após o 500: perfil existe, mas sem categoria, serviço e documento | **Crítico** | `GET /providers/me` após 500: headline "Eletricista", `categoryIds:[]`, `services:[]`, `hasDocument:false`; kyc.tsx:167-185 faz upload só após o POST; card "Documento enviado" (shots/prestador-13) | Admin vê PENDING sem documento; app mostra "Em análise"/"Cadastro profissional" como se estivesse ok; prestador aprovado "na mão" fica sem serviços e invisível para chamada direta | Upsert transacional; upload do documento independente do POST; UI mostrar pendências (sem documento/serviços) |
| P-03 | Negociação morta: proposta em pedido sem pagamento → 409 "pagamento já iniciado" | **Crítico** | `POST /orders/a0553218/proposals {9000}` → `409 Não é possível negociar: o pagamento deste pedido já foi iniciado`; `db.mjs count payment {orderId}` = 0; proposals.ts:75 `payment:payment(id,status)` devolve `[]` (1:N) e `[]` é truthy em `!order.payment` (102/110) | Nem prestador nem cliente conseguem propor valor; S2 inteiro bloqueado | Normalizar `payment` (array → primeiro item/null) como já faz o DTO de order |
| P-04 | Tela de proposta com `role="client"` fixo | **Crítico** (código) | app/client/propose/[id].tsx:4; propose-form.tsx:22,79,84-85,291-353,413; backend proposals.ts:360 (accept próprio 403) e 262-288 (reject próprio NÃO bloqueado) | Prestador vê "Prestador: <ele mesmo>", vê Aceitar/Recusar na própria proposta (Aceitar dá 403; Recusar cancela a própria), e NÃO consegue responder à contraproposta do cliente | Derivar role de `order.client.id !== user.id` (como app/client/order/[id].tsx:32); backend bloquear reject próprio |
| P-05 | Aprovação manual sem canal nem notificação | **Alto** | Não há rota/tela no app; admin só em apps/web/src/app/admin (cookie, ADMIN_PASSWORD); após `db.mjs update status APPROVED` `GET /notifications` não traz nada de aprovação; profile.tsx chip "Cadastro em análise" sem prazo | Prestador não sabe quanto esperar, nem é avisado quando aprovado/bloqueado | Notificação push/in-app na mudança de status; texto com prazo e contato de suporte |
| P-06 | `GET /providers/:id` vaza perfil PENDING e BLOCKED | **Alto** | Com token de outro cliente: `GET /api/providers/852f3a4a` → 200 com nome, bio, serviços, `lastLat/lastLng` tanto em PENDING quanto em BLOCKED (listas `/providers` e `nearby` filtram corretamente) | Perfil não verificado/bloqueado acessível por id (deep link, histórico) e com última posição GPS | Filtrar status APPROVED na rota de detalhe (ou 404) |
| P-07 | Prestador PENDING/BLOCKED já lista ajudas abertas com telefone do cliente | **Alto** | `GET /orders?as=provider` em PENDING e BLOCKED devolve pedidos `isOpenRequest:true` de qualquer categoria com `client.phone`; `GET /orders/:id` → 404 (canViewOpenRequest exige APPROVED, orders.ts:615) | Dados de contato de clientes expostos a quem não foi verificado; inconsistência lista×detalhe | Gate de status também na listagem; não expor telefone antes do aceite |
| P-08 | Ajuda aberta aceita por profissional de outra categoria | **Alto** | S3: ajuda de **Frete** (d0c687f6) aceita pela conta Reparos → 200 ACCEPTED; helper recebeu 403 "Ação permitida apenas ao prestador" | Profissional "rouba" ajudas fora da especialidade; mensagem do perdedor é enganosa | Checar categoria/raio no accept de ajuda aberta; 409 "Alguém já aceitou" |
| P-09 | Sem checagem de "ocupado" no aceite: 2 (3) chamadas ACCEPTED ao mesmo tempo | **Alto** | S4(e): accept 2b8cc6f7 → 200, accept 894a1cca → 200 (já tinha 88f69fb5 ACCEPTED); orders.ts:715-722 só checa busy para ajuda aberta; criação de chamada direta sim checa (450-460) | Prestador aceita várias chamadas simultâneas; cliente que chamar depois recebe 409 "já está em uma chamada" sem saber por quê | Aplicar BUSY_ORDER_STATUSES no accept de chamada direta; UI "Termine a chamada atual" deve ser regra do backend |
| P-10 | Prestador não consegue cancelar/devolver pedido aceito | **Alto** | `cancel` só cliente (orders.ts); após S3/S4e fiquei com ACCEPTED sem saída; brief confirma gap | Prestador preso; cliente precisa cancelar | Permitir cancelamento pelo prestador em ACCEPTED (com motivo/penalidade) |
| P-11 | `offerExpiresAt` com +3 h e nunca aplicado | **Alto** | createdAt `16:16:30.238` (sem fuso) → `offerExpiresAt 19:17:30Z` (TTL 60 s virou 3 h 1 min); accept 8 min depois → 200 (S4b); orders.ts:241-243 calcula no DTO, nenhum check no accept | Cliente vê contagem errada; "expirado" é só visual; prestador aceita chamada que o cliente já abandonou | Guardar timestamps com fuso (timestamptz) ou parsear como UTC; rejeitar accept após expirar |
| P-12 | Carteira credita CASH como "Repasse de pedido concluído" | **Alto** | `GET /wallet` após COMPLETED (CASH): `balanceCents 8000`, tx "Repasse de pedido concluído"; orders.ts:779-788 credita independentemente do método; earnings.tsx "Saldo disponível" | Saldo "disponível" para saque que já foi recebido em mãos → inconsistência financeira | Só creditar PIX/CARD; CASH registrar como "recebido no local" |
| P-13 | Avaliação que o prestador fez do cliente aparece no perfil público do prestador | **Alto** | `GET /providers/852f3a4a/reviews` lista 2 (uma com author "Paulo Prestador QA" sobre a cliente); `rating 5, reviews 1`; reviews.ts:134-137 filtra por orderId sem `targetId` | Perfil público mostra texto escrito pelo próprio prestador como se fosse avaliação recebida | Filtrar `targetId = provider.userId` |
| P-14 | `baseLat/baseLng` nunca enviados pelo app e zerados a cada POST | **Alto** | kyc.tsx:167-182 sem baseLat/baseLng; provider-profile.ts:109-110 `input.baseLat ?? null`; conta UI: `baseLat null` no banco; teste: com base e lastLat nulos `GET /orders?as=provider` deixa de listar abertas e `nearby` não me lista (mas `/providers` lista com `distanceKm:null`) | Prestador novo só "existe" geograficamente depois de ligar o modo (GPS); se nunca ligar, não recebe ajudas abertas e não aparece em "perto de você" | Capturar posição base no KYC; não sobrescrever com null |
| P-15 | KYC: botão mudo com erro fora da tela; raio 0 aceito; mensagens genéricas | **Médio** | shots/prestador-15/16 (toque sem efeito, erro "Escolha uma categoria" no topo); raio "0" vira 10 no banco (shots/prestador-18); "Valor inválido" sem mínimo; backend 422 sempre "Dados inválidos" (raio 0/101, preço 50, nome 1 char, isCompany sem nome, experiência 61 — todos 422 genéricos) | Usuário não sabe o que corrigir | Scroll até o erro + toast; validações locais com limites (1-100 km, R$1 mín, 0-60 anos); 422 com campo |
| P-16 | Reabrir o app não volta ao KYC; sem rascunho | **Médio** | shots/prestador-21: Home do cliente; kyc.tsx sem persistência; signup.tsx:96 `replace` | Perde tudo ao fechar; não há lembrete do cadastro pendente | Rascunho local + banner "Complete seu cadastro" na Home |
| P-17 | Re-enviar KYC depois de aprovado mantém APPROVED | **Médio** | POST /providers/me (payload válido até o RPC) com status APPROVED → `GET /me` continua APPROVED; upsert não toca `status` | Prestador aprovado troca headline/serviços/empresa sem nova análise | Voltar a PENDING em mudanças sensíveis ou versionar |
| P-18 | Chamada direta só como pin no mapa quando modo ligado | **Médio** | shots/prestador-32-home-online ("Chamada para você / 1 no mapa"); index.tsx:480-505 card só com modo desligado | Prestador precisa adivinhar que toca no pin; perde a chamada | Card/CTA "Ver chamada" sempre |
| P-19 | HelpSheet/attend não mostram `scheduledAt` nem a descrição do cliente | **Médio** | help-sheet.tsx (sem scheduledAt; descrição só fallback, 157); shots/prestador-34b sem "Tomada da sala parou"; `GET /orders/a0553218` tem `scheduledAt 2026-11-05T13:00` e notificação "Nova chamada agendada" | Aceita sem saber a data/horário nem o problema | Exibir data agendada e descrição no sheet e no attend |
| P-20 | Notificações levam a telas erradas/vazias | **Médio** | lib/notifications.ts:13-34: `order`+provider → `/client/attend/:id`; "Chamada encerrada" (S4c) → attend de pedido que dá 404; "Cliente confirmou a conclusão" → attend que faz `replace("/client")` (attend-delivery:61-70); propostas → mapa | Toque na notificação não leva a nada útil | Mapear por status (CREATED→sheet, COMPLETED→avaliação, CANCELLED→histórico, proposal→propose) |
| P-21 | Aba "Chamadas" abre em "Pedi" e stats de prestador zeradas | **Médio** | shots/prestador-37/40 ("Você não tem chamadas em andamento"); `me/stats` → `completedOrders 0` com 1 COMPLETED como prestador; profile.tsx:124-135 "0 Concluídos" | Prestador acha que não tem chamadas; perfil mostra 0 concluídos | Abrir em "Atendi" para quem atende; stats por papel |
| P-22 | Horários em UTC na UI (+3 h) | **Médio** | shots/prestador-41: "Aceito 16:16" com relógio 13:21; timestamps sem fuso | Confusão de horário em cards/timeline | Serializar com `Z`/timestamptz |
| P-23 | Toggle "Receber chamadas" em PENDING e vocabulário de helper | **Médio** | profile.tsx:138-167 sempre visível; toast "Cadastro em análise"; attend-turn-on "Pronto para ajudar? / Arraste para atender" (shots/prestador-23) | Convida a uma ação impossível; mistura helper×profissional | Desabilitar com explicação; textos por papel |
| P-24 | Toque acidental na linha do toggle desliga disponibilidade | **Baixo** | fork: seletor ".*Chamadas.*" casou "Disponível para chamadas" e desligou (toast "Modo atendimento desligado") | Prestador fica offline sem perceber | Toggle só no switch ou confirmação |
| P-25 | Ganhos: "Sacar"/"Extrato" decorativos; barras com 1 letra | **Baixo** | earnings.tsx:49-69 toasts; shots/prestador-39 "Q Q S S D S T" | Promessa sem função | Esconder até existir dados bancários; abreviar Seg/Ter |
| P-26 | "Vagas" sem gate de empresa nas rotas | **Baixo** | profile.tsx:53 só esconde o menu; `POST /jobs/me` com conta não-empresa → 403 "Só empresas podem publicar vagas" (correto no backend) | Deep link chega na tela e falha só ao publicar | Gate na rota |
| P-27 | Mesmo bug text=uuid em `POST /addresses/:id/default` | Alto (outra persona) | backend.log: `operator does not exist: text = uuid` em addresses.ts:226 | Definir endereço padrão falha | Corrigir RPC |

## 3. Regras de negócio confusas

- **KYC quebrado (P-01/P-02)**: o cadastro "meio salva", o app diz "Em análise" e o admin recebe um PENDING sem documento e sem serviços. Para o usuário, parece que enviou. Enquanto o RPC não for corrigido, nenhum profissional entra pelo app.
- **Aprovação manual sem canal (P-05)**: não existe no app nem rota de API; só painel web com senha única. O prestador não recebe notificação de aprovação/bloqueio, nem prazo. "Em análise" é um beco.
- **"Ocupado" (P-09/P-10)**: o backend bloqueia só a *criação* de chamada direta para prestador ocupado (409 para o cliente) e o accept de ajuda aberta; o accept de chamada direta passa. E o prestador não tem como se liberar (sem cancelar). A UI diz "Termine a chamada atual" mas Recusar/Propor continuam ativos.
- **Expiração só visual (P-11)**: `offerExpiresAt` é calculado no DTO (+3 h por fuso), não há regra no accept. Cliente e prestador veem coisas diferentes.
- **Negociação (P-03/P-04)**: regra existe (CREATED + allowsNegotiation + sem pagamento), mas o check de pagamento está quebrado e a tela é do cliente. Ligar "Permitir negociar valor" não tem efeito prático.
- **Ajuda aberta × profissional (P-08)**: profissional aprovado e disponível recebe/aceita ajudas abertas de qualquer categoria, sem checagem de raio no accept; perdedor recebe "Ação permitida apenas ao prestador".
- **Dinheiro (P-12)**: CASH entra como saldo disponível.
- **Status visível a terceiros (P-06/P-07)**: listas filtram, detalhe não.

## 4. Telas — o que melhorar

- **signup.tsx**: dizer que é conta de trabalho e que haverá análise; e-mail validado localmente.
- **kyc.tsx**: não mostrar "Em análise"/"Atualizar cadastro" em perfil vazio; scroll até o erro; limites nos campos; posição base; upload do documento independente; mensagem de erro real; rascunho; ao concluir, explicar os próximos passos (análise, prazo, notificação); permitir várias categorias; câmera/PDF.
- **profile.tsx**: chip com prazo/explicação; toggle desabilitado quando não aprovado; stats por papel; "Ocultar botão" sem contexto.
- **work-mode.ts**: texto de emulador em produção (linha 94); `turnOn` cai em "em análise" mesmo sem serviços/documento.
- **index.tsx/help-sheet**: CTA da chamada quando modo ligado; mostrar data agendada, descrição, endereço completo após aceite; vocabulário profissional ("chamada" × "ajuda"); confirmação em Recusar e Terminei; GPS em ACCEPTED de pedido agendado roda por dias (index.tsx:278-282, attend-delivery:55-59).
- **propose-form**: role dinâmico (P-04).
- **attend-delivery/order-detail-attending**: CREATED de chamada direta é tela morta (sem Aceitar/Recusar); explicar regra dos 150 m; mostrar scheduledAt no mapa.
- **earnings.tsx**: esconder Sacar/Extrato; dias abreviados; separar CASH.
- **vaga/jobs**: gate isCompany na rota; confirmação ao fechar vaga/aceitar candidato; vaga continua OPEN após aceitar (ok, mas avisar).
- **notifications.ts**: rotas por status (P-20).
- **orders.tsx**: abrir em "Atendi" para quem atende.

## 5. O que funcionou bem

- Registro 201 com role PROVIDER; tokens e refresh OK (rotação de refresh token funciona).
- Upload de documento: `POST /providers/me/document` 200 com Storage configurado, `hasDocument:true` (3,1 s).
- Gates de status: availability PENDING → 403 "Seu cadastro ainda não foi aprovado."; BLOCKED → 403 "Cadastro bloqueado. Fale com o suporte."; chamada direta para PENDING/BLOCKED → 400 "Essa pessoa não está disponível agora"; `/providers` e `nearby` escondem não aprovados; `GET /orders/:id` de ajuda aberta em PENDING → 404.
- Validação zod: raio 0/101, preço 50, nome 1 char, isCompany sem nome, experiência 61, categoria vazia → 422; location lat 91 → 422.
- Caminho feliz S1: accept → chat (readAt marcado na listagem, `unreadMessages 0`) → start_route com CASH PENDING → start_work longe 409 "Você ainda não chegou ao local do cliente" → perto 200 → complete → AWAITING_CONFIRMATION → cliente confirma → carteira +8000 (priceCents, não totalCents) → review 201; notificações "Nova chamada", "Pode iniciar o trajeto", "Nova mensagem", "Cliente confirmou a conclusão", "Chamada encerrada / O cliente chamou outra pessoa" chegaram com `data.role/type/orderId` corretos.
- S4(a) reject com note → CANCELLED 200; S4(c) pedido reatribuído some da lista e dá 404.
- Vagas (empresa): shift start>end → 422; criar 201; fechar/reabrir 200 com `hiringEmployees` sincronizado; applicants lista; accept/reject 200; responder de novo → 409 "Esta candidatura já foi respondida"; não-empresa → 403 "Só empresas podem publicar vagas"; vaga visível em `GET /jobs`.
- UI: cadastro com máscara de celular, toasts claros em "Cadastro em análise", "Disponível para chamadas", HelpSheet com "Você recebe R$ 80,00", tela attend "Aguardando pagamento" clara, logout limpo.

## 6. Bloqueado / não testado

- **S2 (negociação)**: bloqueado pelo P-03 — S2-4 (aceitar contraproposta), S2-6 (proposta com pagamento, start_route) não executados.
- "Ocupado" na criação de chamada direta (409 para o cliente) não reproduzido do meu lado: o cliente já havia cancelado meus ACCEPTED quando testei (criação deu 201).
- UI: toggle "Sou uma empresa", botões Recusar/Propor do sheet, "Detalhes"/"Ir para o mapa" em Atendi, notificação in-app de "Nova chamada" (só vista pelo pin), Sacar/Extrato.
- Reversão do S3 via banco foi negada pelo classificador de permissões (recurso de outra persona) → cliente cancelou e republicou.
- Painel admin web não exercitado (aprovação simulada via db.mjs).

## 7. IDs criados

- user 07b9e2e9-648e-45dc-98af-e1b6bb20597f (qa-20261103-novo-prestador@teste.app) · providerprofile 852f3a4a-bbd8-40c0-a93e-406787f27815 · services 78d7fc42-c8ad-46d0-b79a-bf087e2b84c7 (Troca de tomada 8000), b571015b-974b-4f15-a69b-4ae89432096c (Instalação de chuveiro 15000) · providercategory reparos.
- user 6cf51569-0b54-4c7a-9dd2-0f21605fe28a (qa-20261103-prest-cli@teste.app, cliente descartável) · address 19a22cc0-783c-4acb-adf2-fab5f1f80929.
- user e330d450-2d5f-4daa-98be-fa7497777fac (qa-20261103-ui-prestador@teste.app) · providerprofile a006f42c-699d-4bf9-8616-00d67c9e3cde · service 5f41bdbf-beac-46f1-a1b7-43ff372f7a8a · order d63b2db2-abbd-4025-affc-bbceda795710 (ACCEPTED, chamada UI).
- Vaga 9d80ab7b-f5b5-47c5-b591-4a0e1fc16c59 (empresa de apoio; CLOSED no fim) · candidaturas b448b85b (helper, ACCEPTED), e0d5568e (cliente, REJECTED).
- Pedidos em que atuei: 243bf5f8 (S1, COMPLETED), d0c687f6 (S3, CANCELLED pelo cliente), 697a9c95 (S4a, CANCELLED por reject), 88f69fb5/2b8cc6f7/894a1cca (S4b/e, CANCELLED pelo cliente), a0553218 (S2, CANCELLED), 1747e5e5 (S4c, reatribuída), f26cb86d (teste, rejeitado). Review 7a07d1b6 (minha, sobre a cliente).
