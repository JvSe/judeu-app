# Pitch ao investidor × o que existe no app — Ajuda+

**Data:** 2026-11-06 · **Origem:** simulação de pitch em 5 rodadas (proposta de valor → liquidez → modelo de negócio → segurança → demanda → investimento).

**Objetivo:** listar tudo o que foi **dito ao investidor** e **não está (ou está só em parte) implementado** no código, para que o pitch não prometa o que uma diligência técnica desmentiria.

**Como foi feito:** leitura do código (`apps/native`, `apps/web`, `packages/db`) — o app **não** foi executado. Referências `arquivo:linha` conferidas por amostragem em 2026-11-06.

**Legenda:** ❌ não existe · 🟡 parcial · ✅ existe (listado só para contraste)

---

## 1. Resumo executivo

| Área | ✅ | 🟡 | ❌ |
|---|---|---|---|
| Matching, liquidez, preço e negócio | 5 | 7 | 5 |
| Segurança, verificação e responsabilidade | 0 | 5 | 11 |

**Três contradições que uma diligência pegaria primeiro:**

1. **Comissão.** O pitch inteiro (margem de R$ 5,20 → R$ 4,95 → R$ 4,65 por pedido, equilíbrio em ~230 pedidos/dia) assume **20% descontados do ajudante**. O código cobra **8% por cima, pagos pelo cliente**, e o ajudante recebe 100% do valor:
   - `apps/web/src/lib/orders.ts:12` — `PLATFORM_FEE_RATE = 0.08`
   - `apps/native/app/client/create-order.tsx:90` — 0,08 repetido no app
   - `apps/web/src/lib/orders.ts:835` — carteira creditada com `priceCents` cheio
   - `apps/native/lib/support-faq.ts:60` — FAQ diz "já descontada a taxa de 8%", o que também está errado
   - Em pedidos em dinheiro a taxa aparece mas nunca é cobrada (QA A-09).
   Com 8% sobre R$ 40 (R$ 3,20) e custos variáveis entre R$ 2,80 e R$ 3,35 por pedido (conforme a rodada), **a margem fica entre R$ 0,40 e negativa**. É preciso decidir o modelo antes de qualquer conversa real.
2. **"Cadastro verificado".** Quem se cadastra como helper nasce `APPROVED` sem documento (`apps/web/src/lib/provider-profile.ts:266-274`) e pode ficar disponível sem aprovação. O bug C-06 do QA (helper vira profissional aprovado sem KYC) continua no código.
3. **"Valhalla".** O pitch e o planejamento citam Valhalla; o código chama o **OSRM público** (`router.project-osrm.org`), só reaproveitando o nome da env `VALHALLA_URL` (`apps/web/src/lib/geo.ts:124-129`).

---

## 2. Rodada 1 — Proposta de valor

| O que foi dito | Status | O que existe hoje | O que reaproveitar |
|---|---|---|---|
| "Você descreve com suas palavras e a IA entende" | ✅ | IA no aparelho (ExecuTorch + Qwen3 1.7B) classifica em profissional / ajuda aberta / vaga e chama ferramentas (`apps/native/lib/assistant.ts:138-318`). **Não funciona no Expo Go/web** (cai no mapa) e não há fallback em nuvem. Tabelas `AiConversation`/`AiMessage` existem e não são usadas. | — |
| "Quem está por perto aceita em minutos" | 🟡 | Push para quem está aprovado, disponível, livre e no raio (`orders.ts:392-446`, limite 100). O TTL de 4 h **só filtra listas**: nada expira nem cancela no servidor. | `notifyAvailableProviders` |
| "Você acompanha a pessoa chegando pelo mapa, como no Uber" | ✅ | Rota OSRM + ETA (`orders.ts:317-338`), tela de acompanhamento (`apps/native/app/client/tracking/[id].tsx`). Atualiza por polling a cada 5 s, não em tempo real. | — |
| "Cadastro verificado" | 🟡 | Profissional: 1 foto de documento. Helper: aprovado sem documento. Ver Rodada 3. | — |
| "Avaliação dos dois lados" | ✅ | `apps/web/src/lib/reviews.ts:46-111`. A lista pública mistura avaliações escritas pelo prestador (QA A-10). | — |
| "Pagamento pelo app e histórico de tudo" | ✅ | Stripe (cartão) e dinheiro. Pix foi recusado no Stripe sandbox (QA). | — |

## 3. Rodada 2 — Liquidez

| O que foi dito | Status | O que existe hoje | O que reaproveitar |
|---|---|---|---|
| Lançar em 2–3 bairros, com horário de operação (8h–20h) | ❌ | Não há zona nem horário. Palmas está fixa no prompt da IA e como coordenada padrão (`orders.ts:13-14`). `Address.neighborhood` é texto livre. | `isInsideServiceRadius` (`orders.ts:33`) → virar checagem por polígono |
| 20 ajudantes-âncora com ganho mínimo garantido de R$ 15/h | ❌ | Carteira só tem CREDIT/DEBIT, sem saque nem repasse (Stripe Connect). Não existe turno, âncora nem subsídio. | `WalletTransaction` (subsídio = CREDIT), modelo `JobShift` (`schema.prisma:588`), toggle `isAvailable` |
| "Antes de pedir, ela vê quantos ajudantes estão por perto e o tempo estimado" | 🟡 | `GET /api/providers/nearby` (`catalog.ts:295-338`) existe, mas só aparece **depois** que a chamada direta expira e **exclui helpers**. ETA = linha reta a 30 km/h. | `listNearbyProviders`, `etaMinFromKm` |
| Sem aceite em 5 min → pedido sobe para um âncora | ❌ | Só reatribuição manual pelo cliente (`reassignOrder`, `orders.ts:941-1004`). Os 60 s da oferta não são aplicados no servidor e saem com +3 h por fuso (QA A-03). | `reassignOrder`, `notifyAvailableProviders` com raio maior |
| Se ninguém aceitar: agendar com prioridade + crédito | ❌ | `Order.scheduledAt` existe, mas o agendamento só aparece na chamada direta (não na ajuda aberta) e nada dispara no horário. `Order.couponCode` é coluna sem uso; não há tabela de cupom/crédito. | `scheduledAt`, `couponCode`, `Wallet` do cliente |
| Preço sugerido por tarefa e horário ("R$ 40 nunca não compensa") | ❌ | Ajuda aberta = campo livre "Quanto vai pagar?", mínimo R$ 1 (`orders.ts:459`). Chamada direta = preço fixo do serviço. | Mediana de `Service.priceCents` por categoria; `OrderProposal` |
| Métrica: % de pedidos aceitos em < 10 min, por bairro (meta 85%) | ❌ | Sem analytics nem painel. Dados brutos existem. | `Order.createdAt/acceptedAt`, `OrderEvent`, `Address.neighborhood` |

## 4. Rodada 2 (cont.) — Modelo de negócio e tecnologia

| O que foi dito | Status | O que existe hoje | O que reaproveitar |
|---|---|---|---|
| Comissão de 20% (R$ 32 ajudante / R$ 8 Ajuda+) | ❌ | 8% por cima do cliente. Ver resumo, item 1. | `PLATFORM_FEE_RATE` → env/DB, por categoria |
| Parceiros B2B (supermercado, farmácia, condomínio) pagando ~R$ 400/mês | ❌ | Não há entidade parceiro, cobrança recorrente nem pedido originado por parceiro. | `ProviderProfile.isCompany` / `JobPosting` (empresa já existe do lado da oferta) |
| Migração por gatilho para Google Places/Geocoding/Routes | ❌ | Troca possível em `geocodeAddress`/`routeBetween` (`apps/web/src/lib/geo.ts`), mas sem interface de provedor. Estilo do mapa fixo em `apps/native/components/ui/real-map.tsx:15-18`. CEP via ViaCEP. | `geo.ts` → interface `GeoProvider` |
| Claude Haiku como fallback da IA no aparelho | ❌ | Nenhum código de LLM em nuvem. | `resolveCategoryId` / `parseHelpRequestFromTool` (`assistant.ts:255,367`); `searchCatalog` como fallback sem IA |
| Gatilhos: "erro de endereço > 3%", "ETA erra > 20%" | ❌ | Nada mede isso. | `OrderEvent` (comparar ETA previsto × chegada real) |

## 5. Rodada 3 — Segurança e responsabilidade

| O que foi dito | Status | O que existe hoje | O que reaproveitar |
|---|---|---|---|
| Níveis de tarefa 1 / 2 / 3 / proibido | ❌ | `Category` sem nível/risco (`schema.prisma:277-290`). O aceite de ajuda aberta **não checa categoria** (`orders.ts:749-770`); categoria só filtra o push. | `ProviderCategory`, `matchesOpenRequestAudience` |
| IA classifica o risco e escala (lâmpada → soquete = nível 3) | ❌ | O assistente só separa profissional / ajuda / vaga (`assistant.ts:154-176`). | Prompt e ferramentas do assistente |
| Selo de reparos (treino + teste + 20 tarefas); profissional com credencial e seguro de RC | ❌ | Nenhum campo de selo, licença ou apólice. `yearsExperience` é autodeclarado. | Bucket privado `kyc-documents`; contagem de concluídos (`profile.ts:59`) |
| Documento + selfie com prova de vida + comparação facial | 🟡 | 1 imagem escolhida da galeria (`apps/native/app/client/kyc.tsx:134-155`), sem câmera, selfie ou liveness. O admin só vê "documento enviado" e **não abre a imagem**. | `uploadKycDocument`, `updateProviderStatus` (`admin/actions.ts:41`) |
| Certidões de antecedentes criminais | ❌ | Nada no código. | Mesmo fluxo de upload do KYC |
| Reverificação facial aleatória antes de iniciar | ❌ | `start_work` só checa GPS. | Guarda em `transitionOrder` (`orders.ts:783-802`) |
| Código de confirmação na porta | ❌ | Não existe. (Foto e nome do ajudante **já aparecem** ao cliente — ✅) | Padrão de código com hash e TTL do `PasswordResetToken` |
| Modo família (filho acompanha quem vai, chegou e saiu) | ❌ | Notificação só para cliente e prestador. Sem contato responsável nem link público de acompanhamento. | `notifyUser`, DTO `tracking` + `withRoute` |
| Início/fim geolocalizados + alerta de tempo excedido | 🟡 | Só a regra de 150 m para **iniciar** (`orders.ts:15,162-171,792-802`), com GPS do próprio aparelho do ajudante (pode ser falsificado). Sem checagem ao concluir, sem duração prevista, sem alerta. | `hasArrivedAt`, `OrderEvent` |
| Botão de emergência (190 + localização) | ❌ | Nenhum. | Categoria de suporte `SECURITY`; `apps/native/lib/location.ts` |
| Preferências do idoso (nota ≥ 4,8, > 50 tarefas, só mulheres) | ❌ | Sem campo gênero; audiência filtra só raio/categoria/ocupado. | `ratingAvg`/`ratingCount`, `matchesOpenRequestAudience` |
| Banimento e denúncia | 🟡 | Admin bloqueia **só prestador**. Sem denúncia, sem banir cliente, sem bloqueio automático por nota baixa. | `ProviderStatus.BLOCKED`, `SupportTicket` |
| Suporte 24 h e resposta a incidentes | 🟡 | Tickets com categoria DISPUTE ligada ao pedido. Sem prazo de atendimento, sem escalonamento; disputa **não retém o pagamento**. | `SupportTicket`, `refundIfPaid` |
| Seguro de acidentes para ajudante e cliente | ❌ | Nada. | — |
| Garantia Ajuda+ (fundo, até R$ 5 mil por tarefa) | ❌ | Sem fundo, reserva ou fluxo de indenização. | `Wallet`/`WalletTransaction`, `platformFeeCents` |
| Conformidade LGPD (biometria, antecedentes, localização) | 🟡 | ✅ aceite de termos, exportação de dados, exclusão lógica, telas de política. ❌ exclusão não apaga documento de KYC nem `lastLat/lastLng`; sem política de retenção. **Vazamentos:** perfil público devolve localização ao vivo (QA A-06); perfis pendentes/bloqueados veem telefone e endereço de ajudas abertas (QA A-07, `orders.ts:629-660`). | `canViewOpenRequest` (`orders.ts:662`) para proteger a lista |
| Impedir empréstimo de conta | ❌ | Vários tokens de sessão por usuário, sem vínculo de aparelho. | Tabela `RefreshToken` |

## 6. Rodada 4 — Validação de demanda

| O que foi dito | Status | O que existe hoje | O que reaproveitar |
|---|---|---|---|
| Teste de preço (R$ 25 / 40 / 60 por grupo) | ❌ | Sem feature flags nem coortes. | — |
| Medir recompra em 30 dias e custo por cliente (CAC) | ❌ | Sem SDK de analytics nem eventos. | `getClientStats` / `batchClientStats` (`apps/web/src/lib/profile.ts`) |
| Indicação (ajudante traz vizinho) | ❌ | Nada. | — |
| Filho paga pelo pedido da mãe / conta família / assinatura | ❌ | `Order` só tem `clientId`; endereço precisa ser do próprio cliente (`orders.ts:482`). | `Order.clientId` + `beneficiaryId` novo |
| Canal síndico/condomínio | ❌ | Nada. | — |

## 7. Rodada 5 — Investimento

| O que foi dito | Status | O que existe hoje | O que reaproveitar |
|---|---|---|---|
| Relatório mensal ao investidor: aceite em < 10 min, recompra, CAC, incidentes | ❌ | Painel admin só tem aprovação de KYC e suporte. | Dados de `Order`, `OrderEvent`, `SupportTicket` |

---

## 8. Prometido, mas não é código

Para não confundir com dívida técnica — são tarefas de operação, jurídico ou negócio:

- Cotação de microsseguro por tarefa com seguradora/insurtech (valida os R$ 0,90 por tarefa).
- Parecer jurídico sobre vínculo empregatício do piso de R$ 15/h e sobre a exigência de antecedentes (LGPD/TST).
- Contrato de mútuo conversível (Marco Legal das Startups).
- 3+ cartas de intenção de parceiros B2B; 40 entrevistas com idosos e filhos.
- Sócio(a) de operações até o dia 90.

## 9. Prioridade sugerida para o piloto de 90 dias

**A. Antes de qualquer usuário real**
- Corrigir os críticos do QA (C-01 a C-06): cadastro de profissional com erro 500, negociação quebrada, helper virando profissional sem KYC.
- Decidir o modelo de cobrança (8% vs 20%), alinhar backend, app e FAQ.
- Helper não pode nascer `APPROVED` sem nenhuma verificação.
- Fechar os vazamentos A-06 e A-07 (localização ao vivo; telefone e endereço para perfis não aprovados).

**B. Necessário para medir o piloto** (sem isso as metas do dia 90 não têm número)
- Eventos/métricas: tempo até aceite, % aceito em < 10 min, recompra em 30 dias — por bairro.
- Expiração real dos pedidos no servidor.
- "N ajudantes perto, ~X min" antes de pedir (incluindo helpers).
- Preço sugerido por categoria (base para o teste de preço).

**C. Necessário para a promessa de segurança com idosos**
- Código na porta, modo família, botão de emergência.
- Níveis de tarefa com bloqueio no aceite.
- Selfie (câmera) no cadastro de quem entra na casa de alguém.

**D. Depois de validar demanda**
- B2B, indicação, conta família/assinatura, migração Google/Claude, seguro e fundo de garantia integrados, âncoras com piso horário.

## 10. Correções na documentação existente

- `docs/planejamento-ajuda-plus.md` marca como ✅ o roteamento **Valhalla** (o código usa OSRM) e o **agendamento (RF-D6)** (só existe na chamada direta e nada dispara no horário).
- QA A-05 (push para todos) parece corrigido: `orders.ts:399` filtra por raio.
- QA A-01 continua valendo: o aceite de chamada direta não checa se o prestador já está ocupado (só a ajuda aberta checa, `orders.ts:762`).
