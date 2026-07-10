# Ajuda+ — Planejamento completo (do protótipo ao produto)

> Documento mestre do projeto **Ajuda+** (`judeu`, `com.judeu.app`): levantamento de
> requisitos, decisões técnicas, roadmap e **log de incrementos** já entregues.
> Complementa os docs específicos em [apps/native/docs/](../apps/native/docs/).

---

## 0. Status / progresso

| Bloco | Requisitos | Status |
|---|---|---|
| **Fundação** — schema Supabase + auth email/senha + camada de dados no app | RNF-1, RF-A1..A3, RNF-2/3 | ✅ **Concluído** |
| **Catálogo real** — categorias/prestadores do Supabase | RF-C3 | ✅ **Concluído** |
| **Pedido + máquina de estados** — criar/aceitar/recusar/cancelar + histórico | RF-D1..D4, RF-D7 (parcial) | ✅ **Concluído** |
| **Avaliação bidirecional + reputação real** | RF-G1, RF-G2 | ✅ **Concluído** |
| **Chat real cliente ↔ prestador** | RF-E1 | ✅ **Concluído** |
| **Pagamento real (Stripe) + split interno** | RF-F1/F2/F3 | ✅ **Concluído** · Pix pendente ativação na conta |
| **Busca por IA conversacional (on-device)** | RF-J1..J5, J7 | ✅ **Código concluído** · ⏳ verificação em device |
| **Geo (Valhalla + Nominatim) na Railway** | RF-C5/C6, RF-E3 (base) | ✅ **Código concluído** · deploy Railway pendente (URLs a caminho) |
| **Carteira/ganhos do prestador (saldo + extrato)** | RF-F4/F5 | ✅ **Concluído** |
| **Onboarding profissional + KYC do prestador** | RF-B1/B2, RF-B3 (parcial) | ✅ **Concluído** · upload de documento pendente ativação do Storage |
| **Notificações push (novo pedido, updates, mensagens)** | RF-E2 | ✅ **Código concluído** · projeto EAS pendente (`eas init`) |
| **Painel admin (moderação de KYC)** | RF-H3 | ✅ **Concluído** |
| **Tracking em tempo real (posição do prestador + ETA)** | RF-E3 | ✅ **Código concluído** · ETA real depende do deploy Railway (Valhalla) |
| **Mapa real (MapLibre + tiles OpenFreeMap)** | RF-C1/C2 | ✅ **Código concluído** · rebuild nativo (`expo prebuild` + build Xcode) validado no simulador iOS — app abre normal; render visual do mapa (por trás do login) ainda não conferida |

**Legenda de prioridade:** **P0** = essencial ao MVP · **P1** = produto sério/confiável · **P2** = maturidade/escala/diferencial.

---

## 1. Contexto

O **Ajuda+** é um **marketplace de serviços locais sob demanda** (estilo GetNinjas/TaskRabbit para o
Brasil), com dois lados: **cliente** ("Quero contratar") e **prestador** ("Quero trabalhar").
Categorias: Reparos, Limpeza, Frete, Beleza. Lançamento inicial em **Palmas/TO**.

**Ponto de partida:** um **protótipo visual só de front-end**, muito polido, em React Native + Expo
(expo-router, unistyles, tema escuro laranja `#FF6600`), com **dados 100% mockados**. Não havia
backend, banco modelado, autenticação, gerência de estado nem integrações reais.

Este documento levanta os **requisitos que faltavam** para virar produto e registra o que já foi
construído, incremento a incremento.

### Decisões técnicas (input de produto)
- **Backend/dados/storage: Supabase** — Postgres (via Prisma), Supabase Storage (perfil, portfólio, KYC, fotos de pedido), Supabase Realtime como opção para chat/tracking.
- **Autenticação: email + senha via API** (custom). Botões sociais (Google/Apple) aparecem na UI mas **sem funcionalidade** por ora (placeholder).
- **Busca por IA (funcionalidade central):** descoberta por **IA conversacional** em vez de grid/filtros. **Decisão desta fase:** rodar o LLM **on-device** (React Native ExecuTorch) num modelo **híbrido** — a IA conversa e chama uma *tool* que busca prestadores **reais** no Supabase. Sem chave de LLM no servidor. Detalhe em [apps/native/docs/ai-search-planning.md](../apps/native/docs/ai-search-planning.md).
- **Mapa e rotas (stack gratuita sobre OpenStreetMap):**
  - Rota **sempre** entre a **casa do cliente** (destino, geocodificada 1x no cadastro) e o **GPS atual do prestador** (origem).
  - Render: **MapLibre RN** + tiles **OpenFreeMap** (grátis, sem chave — trocado do MapTiler free-tier planejado originalmente).
  - Geocoding: **ViaCEP** (CEP→endereço) + **Nominatim self-hosted** (endereço→coords).
  - Rotas/ETA: **Valhalla self-hosted**. Tracking: **Supabase Realtime** move o marcador e recalcula ETA.
  - Ambos (Nominatim/Valhalla) hospedados na **Railway**.

---

## 2. Requisitos Funcionais (por módulo)

### RF-A · Identidade, Conta e Autenticação
- **RF-A1 (P0)** Cadastro com email + senha (nome, telefone) + verificação de email/telefone (OTP). — *base ✅*
- **RF-A2 (P0)** Login/logout via API, sessão segura (`expo-secure-store` + refresh). — ✅
- **RF-A3 (P0)** Papel cliente/prestador no backend (um usuário pode ter os dois). — ✅
- **RF-A4 (P1)** Recuperação de senha.
- **RF-A5 (adiado)** Login social: só os botões na UI, sem função (Apple Sign-In será exigência da App Store se ativado).
- **RF-A6 (P1)** Edição de perfil (foto via Storage, dados, endereço).
- **RF-A7 (P2)** Exclusão de conta e exportação de dados (LGPD/lojas).

### RF-B · Onboarding e Verificação do Prestador (KYC)
- **RF-B1 (P0)** Cadastro profissional (categorias, serviços, preços, área/raio). — ✅
- **RF-B2 (P0)** Verificação de identidade (documento/CPF) antes de aparecer para clientes. — ✅ *upload de documento; conta Supabase Storage pendente ativação*
- **RF-B3 (P1)** Status de aprovação (pendente/aprovado/bloqueado) + moderação. — ✅ *status real (PENDING ao nascer, gate no catálogo) + moderação via painel admin (RF-H3)*
- **RF-B4 (P1)** Disponibilidade on/off.
- **RF-B5 (P2)** Portfólio (fotos) e certificações por categoria.

### RF-C · Descoberta, Busca e Geolocalização
- **RF-C1 (P0)** Localização real do dispositivo. — ✅ *(`expo-location`, foreground)*
- **RF-C2 (P0)** Mapa real (MapLibre + tiles OpenFreeMap). — ✅ *código pronto; rebuild nativo pendente pra verificar em device*
- **RF-C3 (P0)** Consulta de prestadores no Supabase por categoria/serviço + geo — alimenta mapa e IA. — ✅
- **RF-C4 (P1)** Filtros/ordenação tradicionais (fallback à IA). — *fallback em uso na Explorar*
- **RF-C5 (P1)** Distância/ETA real via Valhalla. — ✅ *código pronto (rota prestador→endereço); ETA real depende do deploy Railway*
- **RF-C6 (P2)** Busca por endereço/CEP (ViaCEP + Nominatim) + múltiplos endereços. — ✅ *ViaCEP no cadastro do pedido; geocoding Nominatim no servidor (fallback pro centro de Palmas sem Railway); múltiplos endereços fora de escopo*

### RF-J · Busca por IA conversacional (funcionalidade central) 🌟
- **RF-J1 (P0)** Chat com assistente em linguagem natural (caminho primário de descoberta). — ✅ (on-device)
- **RF-J2 (P0)** IA conversa/esclarece (serviço, urgência, orçamento, endereço). — ✅
- **RF-J3 (P0)** Interpretação de intenção → categoria/serviço + parâmetros estruturados. — ✅
- **RF-J4 (P0)** Matching via *function calling* sobre dados reais do Supabase (não inventa prestadores). — ✅ (tool on-device → catálogo real)
- **RF-J5 (P0)** Resultados dentro da conversa (cards ver perfil/contratar). — ✅
- **RF-J6 (P1)** Contexto/histórico persistidos entre sessões.
- **RF-J7 (P1)** Streaming + estados de carregamento/erro + fallback tradicional. — ✅ (streaming + chips de categoria)
- **RF-J8 (P2)** Multimodal (foto do problema → serviço) e voz (STT).
- **RF-J9 (P2)** Guardrails/escopo/anti-abuso do assistente.

### RF-D · Pedido / Contratação (coração do marketplace)
- **RF-D1 (P0)** Criar pedido (categoria, descrição, endereço, data/hora, fotos). — ✅
- **RF-D2 (P0)** Máquina de estados `criado → aceito → a caminho → em execução → concluído/cancelado`. — ✅
- **RF-D3 (P0)** Aceite/recusa pelo prestador. — ✅
- **RF-D4 (P0)** Cancelamento (cliente/prestador) com regras. — ✅
- **RF-D5 (P1)** Orçamento/negociação antes do aceite.
- **RF-D6 (P1)** Agendamento (data/hora futura). — *toggle na UI, falta enviar data*
- **RF-D7 (P1)** Histórico de pedidos. — ✅ (em andamento × concluídos)
- **RF-D8 (P2)** Recontratar/repetir pedido; favoritos.

### RF-E · Comunicação em tempo real
- **RF-E1 (P0)** Chat cliente↔prestador real (persistido, entregue/lido). — ✅
- **RF-E2 (P0)** Notificações push (novo pedido, updates, mensagens). — ✅ *código pronto; falta rodar `eas init` pra gerar o projectId*
- **RF-E3 (P1)** Tracking em tempo real (Supabase Realtime + rota Valhalla no MapLibre). — ✅ *código pronto; REST+GPS foreground (não Supabase Realtime, não MapLibre — ver incremento); ETA real depende do deploy Railway*
- **RF-E4 (P2)** Áudio/mascaramento de telefone.

### RF-F · Pagamentos e Financeiro
- **RF-F1 (P0)** Pagamento real — Pix, cartão, dinheiro (gateway: Stripe). — ✅
- **RF-F2 (P0)** Cálculo: serviço + taxa da plataforma + cupom. — ✅ *taxa 8% aplicada no pedido*
- **RF-F3 (P0)** Split/repasse ao prestador + comissão. — ✅ *ledger interno (Wallet), sem Stripe Connect*
- **RF-F4 (P1)** Carteira/ganhos do prestador (saldo, extrato, saques). — ✅ *saldo/extrato; saque pendente (depende de KYC/dados bancários)*
- **RF-F5 (P1)** Recibos/comprovantes e histórico de transações. — ✅ *extrato (`WalletTransaction`) na tela de ganhos*
- **RF-F6 (P1)** Reembolso/estorno em cancelamentos. — ✅ *(entregue no incremento de pagamento Stripe)*
- **RF-F7 (P2)** Cupons/promoções, carteira de crédito, gorjeta.

### RF-G · Reputação e Confiança
- **RF-G1 (P0)** Avaliação bidirecional após conclusão (nota + comentário). — ✅
- **RF-G2 (P1)** Avaliações reais no perfil do prestador. — ✅
- **RF-G3 (P1)** Denúncia/report.
- **RF-G4 (P2)** Moderação de avaliações; resposta do prestador; selo "verificado".

### RF-H · Suporte, Disputas e Administração
- **RF-H1 (P1)** Central de ajuda/suporte (FAQ, chamado).
- **RF-H2 (P1)** Fluxo de disputa/contestação.
- **RF-H3 (P1)** Painel administrativo (web, `apps/web`). — ✅ *moderação de KYC (fila + aprovar/bloquear)*
- **RF-H4 (P2)** Anti-fraude/abuso.

### RF-I · Notificações e Preferências
- **RF-I1 (P1)** Centro de notificações in-app + preferências por evento.
- **RF-I2 (P2)** i18n (hoje pt-BR hardcoded).

---

## 3. Requisitos Não-Funcionais

- **RNF-1 · Supabase (P0):** schema modelado (User, Provider, Service, Category, Order, Review, etc.), Storage, RLS por papel, cliente de dados no app. — ✅ *(13 tabelas + auth)*
- **RNF-1b · Infra de IA (P0):** orquestração do assistente. — ✅ *revisado para on-device (sem servidor/chave); ver [ai-search-planning](../apps/native/docs/ai-search-planning.md)*
- **RNF-2 · Estado/dados no app (P0):** TanStack Query + sessão/auth. — ✅
- **RNF-3 · Segurança (P0):** hash de senha, tokens/refresh, secure-store, validação, rate limiting, endpoints por papel. — ✅ *(base)*
- **RNF-4 · Privacidade/LGPD (P0):** consentimento, política/termos, exclusão/exportação, minimização de localização.
- **RNF-5 · Permissões do device (P0):** localização, notificações, câmera/galeria com justificativas.
- **RNF-6 · Confiabilidade/tempo real (P1):** push (Expo) — ✅ *código pronto, EAS pendente*; WebSocket, reconexão, offline.
- **RNF-7 · Observabilidade (P1):** logs, Sentry, analytics de funil.
- **RNF-8 · Qualidade (P1):** testes, CI, lint/typecheck no `turbo.json`, tipagem ponta-a-ponta.
- **RNF-9 · Acessibilidade (P1):** labels, contraste, tamanho de toque.
- **RNF-10 · Release (P1):** nome real, ícones/splash, envs por ambiente, EAS Build/Submit, versionamento.
- **RNF-11 · Performance (P2):** paginação/virtualização, otimização de imagem/mapa, cache.
- **RNF-12 · Escalabilidade (P2):** filas, jobs de matching, geoindexação.

---

## 4. Telas × Requisitos

### Existentes (ganham requisitos reais)
| Tela / Rota | Estado inicial | Requisitos |
|---|---|---|
| **Onboarding** `app/index.tsx` | Escolha de papel | RF-A1/A2/A3; termos (RNF-4) |
| **Home Cliente** `client/(tabs)/index.tsx` | Mapa-imagem + mock | RF-C1/C2 ✅, RF-C3/C5, RNF-5; barra abre IA (RF-J1) |
| **Explorar/IA** `client/(tabs)/explore.tsx` | Grid mock | **RF-J1..J7** (assistente); RF-C4 fallback — ✅ |
| **Pedidos (Cliente)** `client/(tabs)/orders.tsx` | Placeholder | RF-D7/D2/D8 — ✅ |
| **Perfil Cliente** `client/(tabs)/profile.tsx` | Estático | RF-A6/A2/A7, RF-C6, RF-I1 |
| **Detalhe do Prestador** `client/provider/[id].tsx` | Perfil mock | RF-D1 ✅, RF-G2 ✅, RF-B5, RF-C5 |
| **Pagamento** `client/payment/[id].tsx` | Fake | RF-F1/F2 ✅, F5, RNF-3 |
| **Tracking** `client/tracking/[id].tsx` | Animação | RF-E3, RF-D2 ✅, RF-E2 ✅ |
| **Chat** `client/chat/[id].tsx` | Array mock | RF-E1 ✅, RF-E2 ✅, RF-E4 |
| **Dashboard Prestador** `provider/(tabs)/index.tsx` | Mock | RF-D3 ✅, RF-B4, RF-E2 ✅ |
| **Mapa Prestador** `provider/(tabs)/map.tsx` | Placeholder | RF-C2/C1 ✅, RF-E3 ✅ |
| **Ganhos** `provider/(tabs)/earnings.tsx` | Placeholder | RF-F4/F5 ✅, RF-F3 |
| **KYC/Cadastro profissional** `provider/kyc.tsx` | Mock (badges falsos) | RF-B1/B2/B3 — ✅ |
| **Perfil Prestador** `provider/(tabs)/profile.tsx` | Estático | RF-B1/B2/B3 ✅, RF-B5, RF-A6/A2 |

### Novas a criar
Login/Cadastro/OTP (RF-A1/A2/A4) · Busca por IA (RF-J, ✅ na Explorar) · Onboarding Prestador/KYC (RF-B1/B2/B3, ✅ · RF-B5 pendente) · Criar/Configurar Pedido (RF-D1/D5/D6, ✅ base) · Detalhe do Pedido/Estados (RF-D2/D4/D7, ✅) · Avaliação pós-serviço (RF-G1/G2, ✅) · Push (RF-E2, ✅ código) · Painel Admin (RF-H3, ✅) · Centro de Notificações in-app (RF-I1) · Suporte/Disputa (RF-H1/H2) · Termos & Permissões (RNF-4/5) · Anti-fraude/abuso (RF-H4, RNF-7).

---

## 5. Roadmap (priorização)

1. **Fundação (P0):** Supabase + Storage + RLS (RNF-1), Auth (RF-A1..A3), estado/dados (RNF-2), segurança (RNF-3), LGPD/permissões (RNF-4/5), infra de IA (RNF-1b). — ✅ *(núcleo)*
2. **Núcleo do marketplace (P0):** KYC (RF-B1/B2) ✅, localização+mapa (RF-C1..C3), **IA conversacional (RF-J)** ✅, pedido+estados (RF-D1..D4) ✅, pagamento (RF-F1..F3), chat (RF-E1) ✅ + push (RF-E2) ✅, avaliação (RF-G1) ✅.
3. **Confiança e financeiro (P1):** histórico (RF-D7) ✅, carteira (RF-F4/F5) ✅ · reembolso (RF-F6) ✅, tracking (RF-E3), avaliações no perfil (RF-G2) ✅, suporte/disputa (RF-H1/H2), admin (RF-H3) ✅, observabilidade/testes (RNF-7/8).
4. **Maturidade/escala (P2):** filtros/agendamento/cupons/portfólio/i18n/anti-fraude/performance (RF-C4/C6, RF-D6, RF-F7, RNF-11/12).

---

## 6. Log de incrementos entregues

### ✅ Incremento 1 — Fundação
Schema Supabase (Prisma, **13 tabelas**) + auth custom (bcrypt + JWT + refresh rotacionável) em
`apps/web/src/app/api/auth/*` + camada de dados no app (`apps/native/lib/`: tokens/secure-store, api
client com refresh automático, auth-context, TanStack Query) + telas login/signup reais + guarda de
sessão em `client/_layout.tsx` e `provider/_layout.tsx`. **Verificado E2E contra o Supabase**
(cadastro/login/me/refresh/erros). `db push` aplicado.

### ✅ Incremento — Catálogo com dados reais (RF-C3)
Backend (`apps/web/src/lib/catalog.ts` + rotas `categories`, `providers`, `providers/[id]`,
`dev/seed`) + camada nativa (`catalogApi`, hooks, `format.ts`) ligando **Explorar**, **Home** e
**Detalhe do prestador** a dados reais. Verificado E2E (seed 4 categorias/3 prestadores, contagens, 401/404).

### ✅ Incremento — Fluxo de pedido + máquina de estados (RF-D1..D4, D7 parcial)
**Backend** (`apps/web/src/lib/orders.ts` + rotas):
- `POST /api/orders` — cliente cria pedido para prestador APPROVED; preço do serviço; **taxa 8%** (RF-F2 parcial); `Address` inline (lat/lng no centro de Palmas até o geocoding) + evento `CREATED`.
- `GET /api/orders?as=client|provider` — pedidos do usuário no papel escolhido.
- `GET /api/orders/[id]` — detalhe + eventos (visível só às partes).
- `POST /api/orders/[id]/transition` — estados com autorização por papel: `accept`/`reject`/`start_route`/`start_work`/`complete` (prestador), `cancel` (cliente); grava `OrderEvent` e carimba timestamps.

**App:** `ordersApi` + hooks (`useOrders`/`useOrder`/`useCreateOrder`/`useTransitionOrder`); "Contratar
agora" → Criar pedido → Detalhe; timeline real; **Meus pedidos** (andamento × concluídos); **Dashboard
do prestador** (fila real + stats).

**Verificado E2E:** ciclo `CREATED→…→COMPLETED`; preço/taxa (R$60 → fee R$4,80 → total R$64,80);
cancelamento; guardas **409/403/401/404**. Typecheck web+native limpos.

**Pendências:** `scheduledAt` (RF-D6) tem toggle mas não envia data; endereço sem geocoding (RF-C6);
pagamento (RF-F1) mock; tracking (RF-E3) e chat (RF-E1) ainda mock.

### ✅ Incremento — Avaliação bidirecional + reputação real (RF-G1, RF-G2)
Sem migração (models `Review` e `ProviderProfile.ratingAvg/ratingCount` já existiam).
**Backend** (`apps/web/src/lib/reviews.ts` + rotas):
- `POST /api/orders/[id]/review` — avalia a **outra parte** de um pedido `COMPLETED` (nota 1–5 + comentário); 1 review por autor/pedido; **recalcula a reputação real** do prestador.
- `GET /api/orders/[id]/review` — o review do usuário (trava/prefill).
- `GET /api/providers/[id]/reviews` — avaliações públicas do perfil.

**App:** `reviewsApi` + hooks; **tela de avaliação** real (estrelas/tags/comentário, estado "já
avaliado"); **Detalhe do prestador** com seção **Avaliações**.

**Verificado E2E:** review 5★ (**201**) → reputação recalculada (`4.9/328` mock → `5/1` real); guardas
**409/409/403/401/400**. Typecheck limpos.

**Pendência:** avaliação **prestador → cliente** existe no backend, falta a tela do lado do prestador;
gorjeta (RF-F7) removida da UI (depende de pagamento).

### ✅ Código concluído · ⏳ device — Busca por IA conversacional on-device (RF-J1..J5, J7)
Abordagem **híbrida on-device** (substitui o Claude-via-API do plano original): LLM **no aparelho** via
**React Native ExecuTorch**; *matching* usa dados **reais** do Supabase — sem chave Anthropic nem custo
de servidor. Doc dedicado: [apps/native/docs/ai-search-planning.md](../apps/native/docs/ai-search-planning.md).

- **Modelo:** Qwen3 1.7B quantizado; a IA chama a tool **`buscar_prestadores`** (function calling nativo 0.9.2); a tool executa `catalogApi.providers(categoryId)` → **não inventa prestadores** (RF-J4). Cards reais na conversa.
- **Config nativa:** deps ExecuTorch + adapter Expo (alinhados ao SDK 56); `app.json` com `expo-build-properties` (iOS 17 / Android 33); `metro.config.js` (`.pte`/`.bin`); `initExecutorch` guardado no `_layout.tsx`.
- **App:** `lib/assistant.ts`, `components/ai-assistant.tsx` (3 estados obrigatórios + streaming + chips de fallback RF-J7), `explore.tsx` (assistente quando há runtime nativo; senão grid tradicional RF-C4).
- **Verificado:** `tsc --noEmit` native limpo; API 0.9.2 conferida nos `.d.ts`.
- **Handoff (com você):** `cd apps/native && npx expo prebuild --clean && npx expo run:android` (ou `run:ios` em device físico). Primeiro uso baixa o `.pte` (~centenas de MB). Validar qualidade do function calling; se preciso trocar `AI_MODEL`.

### ✅ Incremento — Chat real cliente ↔ prestador (RF-E1)
Sem migração (model `Message` já existia no schema). Arquitetura mantida: app nativo não fala
direto com o Supabase, então "tempo real" aqui é **REST + polling via TanStack Query** (4s, só
com a tela em foco via `useIsFocused`), não Supabase Realtime.

**Backend** (`apps/web/src/lib/chat.ts` + rota `apps/web/src/app/api/orders/[id]/messages/route.ts`):
- `GET` — histórico do pedido (ordenado por `createdAt`); marca como lidas, como efeito colateral,
  as mensagens da outra parte (read-receipt implícito).
- `POST` — envia mensagem; autorização só por participante do pedido (sem gating por status —
  chat aberto do `CREATED` ao `CANCELLED`/`COMPLETED`).

**App:** `chatApi` + `useMessages`/`useSendMessage`; **tela de chat do cliente** reescrita para
dados reais (removido o mock `chatMessages`/`providers`); **nova tela de chat do prestador**
(`provider/chat/[id].tsx`, registrada em `provider/_layout.tsx`); botão de chat nos cards de
pedido ativo do **dashboard do prestador**.

**Verificado E2E:** ciclo completo via curl — 401 sem token, 201 ao enviar, 403 para terceiro não
relacionado, `readAt` preenchido ao listar como a outra parte, ordem ascendente, 400 corpo vazio,
404 pedido inexistente. Typecheck web+native limpos (routes tipadas regeneradas).

### ✅ Incremento — Pagamento real (Stripe) + split interno (RF-F1/F2/F3)
Sem Stripe Connect (evita depender do KYC do prestador, RF-B2, ainda pendente): Stripe cobra o
cliente na conta da plataforma; o repasse ao prestador é um **ledger interno**
(`Wallet.balanceCents` + `WalletTransaction`), creditado quando o pedido é concluído. Schema
(`Payment`/`Wallet`/`WalletTransaction`) já existia — sem migração.

**Backend** (`apps/web/src/lib/stripe.ts`, `apps/web/src/lib/payments.ts` + rotas
`apps/orders/[id]/payment` e `apps/webhooks/stripe`):
- `POST .../payment` — cliente cria/atualiza o pagamento (`PIX`/`CARD`/`CASH`); Pix confirma na
  criação e retorna QR (`next_action.pix_display_qr_code`); cartão retorna `clientSecret` pro
  `PaymentSheet`; dinheiro só grava `PENDING` (paga na entrega).
- `GET .../payment` — reconcilia com o Stripe (`paymentIntents.retrieve`) se ainda pendente, sem
  depender só do webhook (cobre rodar sem `stripe listen` local).
- `apps/web/src/lib/orders.ts` (`transitionOrder`): ao **completar**, marca dinheiro como pago e
  credita `priceCents` (sem a taxa) na carteira do prestador; ao **recusar/cancelar** um pedido já
  pago, estorna via `stripe.refunds.create` e marca `REFUNDED`.

**App:** `paymentsApi` + `useOrderPayment` (poll)/`useCreatePayment`; **tela de pagamento**
reescrita (dados reais do pedido, seletor Pix/Cartão/Dinheiro); Pix mostra QR + copia-e-cola
(`expo-clipboard`); cartão usa `@stripe/stripe-react-native` (`PaymentSheet`); `StripeProvider`
no `_layout.tsx`; fluxo real agora passa por `create-order → payment → order detail`.

**Verificado E2E** com a conta sandbox real: dinheiro (pedido completo → carteira creditada em
`priceCents`), cartão (PaymentIntent confirmado via API do Stripe simulando o app → reconciliação
`GET` → carteira creditada cumulativamente), reembolso automático ao recusar pedido já pago
(`REFUNDED`), guardas 401/403/404/409. **Pix criado mas não confirmável nesta conta** — o Stripe
recusou `payment_method_types: ["pix"]` (`payment_intent_invalid_parameter`): a conta sandbox
precisa ativar Pix em Dashboard → Settings → Payment methods (ou ser Brasil-domiciliada). Código
e contrato da API estão prontos; falta só essa ativação — handoff com você.

**Pendências:** tela de carteira/ganhos do prestador (RF-F4, próximo bloco sugerido); `PaymentSheet`
do cartão e o ecrã de QR do Pix exigem rebuild nativo (`expo prebuild`) pra testar na UI de verdade.

### ✅ Incremento — Carteira/ganhos do prestador (RF-F4, RF-F5)
Sem migração (`Wallet`/`WalletTransaction` já existiam e já eram alimentados pelo incremento de
pagamento). Só leitura: agrega o ledger interno para a tela de ganhos.

**Backend** (`apps/web/src/lib/wallet.ts` + rota `apps/web/src/app/api/wallet/route.ts`):
- `GET /api/wallet` — saldo atual (`Wallet.balanceCents`), ganhos líquidos (crédito − débito) dos
  últimos 7 dias agrupados por dia (para o gráfico de barras) e extrato (`WalletTransaction`,
  últimas 20, mais recentes primeiro). Usuário sem carteira ainda (ex.: cliente puro) recebe
  estado zerado em vez de erro.

**App:** `walletApi`/`useWallet`; tela **Ganhos do prestador** reescrita com dados reais (saldo,
gráfico "Ganhos por dia", extrato) — removidos os mocks `weeklyEarnings`/`earningsHistory`;
`useTransitionOrder` invalida `["wallet"]` para o saldo refletir na hora após um pedido concluir.
Botões "Sacar"/"Extrato" seguem só visuais (saque depende de KYC/dados bancários, RF-B2 — próximo
bloco).

**Verificado E2E:** 401 sem token; conta sem carteira → estado zerado; prestador com histórico real
(seed + pedidos já concluídos nos incrementos anteriores) → saldo/extrato/bucket "hoje" batendo
com as `WalletTransaction` existentes. Typecheck web+native limpos.

### ✅ Incremento — Onboarding profissional do prestador + KYC (RF-B1/B2, RF-B3 parcial)
Sem migração (`ProviderProfile.status`/`documentUrl`, `ProviderCategory`, `Service` já existiam no
schema). Prestador nasce com `ProviderProfile` vazio (`status: PENDING`) já no cadastro — antes
disso não existia nenhum jeito de criar/editar o perfil profissional em produção (só via seed).

**Backend:**
- `apps/web/src/lib/storage.ts` — cliente Supabase Storage (service role, `@supabase/supabase-js`);
  `uploadKycDocument` sobe o documento pro bucket privado `kyc-documents` (`{userId}/{timestamp}.ext`)
  e retorna o path (não uma URL pública — o app nunca fala com o Supabase direto).
- `apps/web/src/lib/provider-profile.ts` — `getMyProviderProfile`/`upsertMyProviderProfile` (substitui
  categorias e serviços por completo a cada chamada, em transação)/`setProviderDocument`.
- `POST/GET /api/providers/me` e `POST /api/providers/me/document` — só para role `PROVIDER`/`BOTH`
  (403 pro resto); `GET /api/providers/[id]` e `listProviders` já filtravam `status: APPROVED`, então
  o gate "não aparece pra clientes antes da aprovação" (RF-B2) já valia sem código novo ali.
- `apps/web/src/app/api/auth/register/route.ts` — cria o `ProviderProfile` (vazio, `PENDING`) junto
  com o `User` quando `role` é `PROVIDER`/`BOTH`.

**App:** `providerProfileApi` + `useMyProviderProfile`/`useUpsertProviderProfile`/
`useUploadProviderDocument`; **tela de KYC** (`provider/kyc.tsx`) reescrita — era 100% mock (badges
"CPF validado"/"Documento com foto" fixos, botão "Continuar" sem ação nenhuma); agora é um form real
(categoria, o que você faz, bio, anos de experiência, raio de atuação, lista de serviços com
preço, upload do documento via `expo-image-picker`) que gera o cadastro de verdade; **Perfil do
prestador** e **Dashboard** mostram o status real (`PENDING`/`APPROVED`/`BLOCKED`) com banner/CTA
para completar ou editar o cadastro, no lugar do "Carlos Mendes" fixo.

**Verificado E2E** via curl: registro com `role: PROVIDER` já cria o profile (`PENDING`, campos
zerados); `POST /api/providers/me` grava categoria/serviços reais; 401 sem token; 403 pra usuário
`CLIENT`; 422 payload inválido (sem categoria/serviço); upload de documento falha com erro claro
("Supabase Storage não configurado") em vez de 500 genérico — a conta ainda não tem
`SUPABASE_SERVICE_ROLE_KEY` nem o bucket criado. Typecheck web+native limpos.

**Pendências:** ativar a conta Supabase Storage (criar bucket privado `kyc-documents` + preencher
`SUPABASE_SERVICE_ROLE_KEY` em `apps/web/.env`) para o upload do documento funcionar de ponta a
ponta — handoff com você; moderação (`PENDING`→`APPROVED`/`BLOCKED`) agora tem painel próprio, ver
[Painel admin (RF-H3)](#-incremento--painel-admin-rf-h3) abaixo; portfólio/certificações (RF-B5)
fora de escopo (P2); formulário assume 1 categoria por prestador (schema já suporta várias via
`ProviderCategory`, é m2m).

### ✅ Código concluído · ⏳ EAS pendente — Notificações push (RF-E2)
Migração: `User.pushToken` (String?, token do último dispositivo logado). Via **Expo Push API**
(gratuita, sem chave/servidor próprio) — mesma filosofia de "sem infra paga extra" do resto do
projeto. Um usuário só recebe push no último dispositivo em que logou (troca de token no login);
múltiplos dispositivos simultâneos ficam para depois se virar necessidade.

**Backend:**
- `apps/web/src/lib/push.ts` — `sendPushNotification(userId, {title, body, data})`: busca o
  `pushToken` do usuário e faz POST pro `exp.host/--/api/v2/push/send`; **best-effort** (captura
  qualquer erro e não propaga) — nunca deve derrubar o fluxo principal (criar pedido, mandar
  mensagem) se o push falhar ou o usuário não tiver token.
- `POST /api/push-token` — salva/substitui o token do dispositivo atual (chamado após login).
- Disparos wireados direto nos módulos de domínio (sem acoplar rota): `createOrder` notifica o
  prestador ("Novo pedido"); `transitionOrder` notifica a outra parte a cada ação (aceite, recusa,
  a caminho, em execução, concluído pro cliente; cancelamento pro prestador); `sendMessage`
  notifica quem não mandou a mensagem. Todos fire-and-forget (`void`), não bloqueiam a resposta.

**App:** `pushApi.register`; `lib/push.ts` (`registerForPushNotificationsAsync` — permissão +
`Notifications.getExpoPushTokenAsync`, retorna `null` sem quebrar nada se faltar permissão, device
físico ou projeto EAS); registrado após login/cadastro/restauração de sessão (`auth-context.tsx`),
best-effort. `app/_layout.tsx`: handler pra mostrar o alerta com o app aberto + listener de toque
que navega pro pedido/chat certo (`data: {type, orderId, role}` decide o destino: chat do
cliente/prestador, detalhe do pedido do cliente, ou dashboard do prestador). `expo-notifications` +
`expo-device` instalados; plugin configurado no `app.json` (ícone monochrome Android, cor laranja).

**Verificado E2E** via curl: `POST /api/push-token` funciona (200) e falha 401/422 nos guardas;
criar pedido, mandar mensagem e transicionar (aceite/cancelamento) continuam respondendo normal
com um token fake registrado (a chamada real ao Expo é best-effort e não interfere na resposta).
Typecheck web+native limpos.

**Pendências:** rodar `eas init` (você está logado no Expo CLI como `nextmed`, mas o app ainda não
tem projeto EAS vinculado) — sem isso, `getExpoPushTokenAsync` não consegue gerar token e o app
segue funcionando normalmente, só sem push; depois de `eas init`, precisa de um build nativo novo
(`expo prebuild` + rebuild) pra testar de ponta a ponta, já que o plugin `expo-notifications` altera
código nativo. Centro de notificações in-app (RF-I1) e preferências por evento ficam pra depois.

### ✅ Incremento — Painel admin (RF-H3)
Sem migração (`ProviderProfile.status` já existia da KYC). Auth própria e minimalista: senha única
compartilhada (`ADMIN_PASSWORD`), sem conta/role de admin no banco — sessão via cookie HttpOnly
assinado (mesma lib `jose` do JWT de auth do app), checado direto em Server Components/Actions
(sem `middleware.ts`, pra não esbarrar em edge runtime — `packages/env/src/server.ts` usa
`dotenv/config`, que precisa de Node.js runtime).

**Backend:**
- `apps/web/src/lib/admin-auth.ts` — `checkAdminPassword` (comparação em tempo constante,
  `timingSafeEqual`), `signAdminSession`/`hasAdminSession`/`requireAdminSession` (JWT no cookie
  `admin_session`, 7 dias).
- `apps/web/src/lib/provider-profile.ts` — `listAllProviderProfiles` (todos os prestadores,
  pendentes primeiro) e `setProviderProfileStatus` (novas, pro admin).
- `apps/web/src/app/admin/actions.ts` — Server Actions `loginAdmin`/`logoutAdmin`/
  `updateProviderStatus` (essa última chama `requireAdminSession` antes de gravar).
- `packages/env/src/server.ts` — `ADMIN_PASSWORD` (opcional, min 8 chars).

**Web:** `/admin/login` (form simples, senha) e `/admin` (protegida por route group
`admin/(protected)/layout.tsx`, que redireciona pra login se não tiver sessão válida) — fila de
prestadores `PENDING` em destaque + lista de todos, com botões Aprovar/Bloquear/Voltar p/ pendente
por linha (`updateProviderStatus.bind(null, providerId, status)` + `revalidatePath("/admin")`).
Componentes `@judeu/ui` (`Button`/`Card`/`Input`/`Label`).

**Verificado E2E** via Playwright (browser real, Chromium): login com senha errada →
`/admin/login?error=1`; login correto → `/admin`; sessão persiste entre navegações e é limpa no
logout (`/admin` redireciona pra login depois de sair); Aprovar/Bloquear/Voltar-p/-pendente
disparam o POST certo e o novo status é lido de volta do servidor após reload (não é só patch
client-side) — testado nos três sentidos numa fila real. Zero erros de console. Typecheck web
limpo (`npx next typegen` precisou rodar uma vez pra gerar os tipos de rota novos).

**Bug encontrado e corrigido durante a verificação:** os botões de ação (Aprovar/Bloquear/Voltar p/
pendente) não submetiam o form — o `Button` do `@judeu/ui` (base-ui) usa `type: 'button'` como
default interno pra qualquer `<button>` nativo, então sem `type="submit"` explícito o clique não
fazia nada. Vale lembrar pra qualquer botão novo do `@judeu/ui` dentro de `<form>` em qualquer lugar
do `apps/web`.

**Pendências:** só senha única por ora, sem conta/role de admin nem log de quem aprovou/bloqueou
(RF-H4/RNF-7 ficam pra depois); painel cobre só moderação de KYC — não tem visão de pedidos,
usuários ou disputas (RF-H1/H2).

### 📦 Repo/instruções prontos · deploy com você — Geo (Valhalla + Nominatim) na Railway
Rota+ETA (**Valhalla**, porta 8002) e geocoding endereço→coords (**Nominatim**, porta 8080),
OSM/gratuitos, self-hosted na **Railway**. Cobertura inicial **Palmas/TO** (PBF do estado do
Tocantins). Estrutura `apps/geo/{valhalla,nominatim}` (Docker-only). Glue no app em
`apps/web/src/lib/geo.ts` (`geocodeAddress`, `routeBetween`). Consumo já preparado em
`packages/env/src/server.ts` (`VALHALLA_URL`/`NOMINATIM_URL`).

**Handoff:** criar os 2 serviços na Railway (Root Directory + Volume + envs conforme README), rodar os
smoke tests (curl `/route` e `/search`) e colar as URLs em `apps/web/.env`.

### ✅ Código concluído · ⏳ ETA real pendente Railway — Endereço real + tracking em tempo real (RF-C5/C6, RF-E3)
Migração: `Order.providerLat`/`providerLng`/`providerLocationAt` (Float?/Float?/DateTime?, `db push`
aplicado). Sem mudar a arquitetura decidida no incremento de chat: nada de Supabase Realtime nem
MapLibre aqui — REST + polling (mesmo padrão) e o mapa segue com o backdrop estilizado existente,
só que agora alimentado por dados reais em vez de mock.

**Backend** (`apps/web/src/lib/orders.ts` + rotas):
- `createOrder` — quando o app não manda `lat`/`lng` prontos, geocodifica o endereço via
  **Nominatim** (`geocodeAddress`, já existia em `lib/geo.ts` do repo `apps/geo`); best-effort — sem
  `NOMINATIM_URL` (Railway pendente) ou endereço não encontrado, cai no centro de Palmas (mesmo
  fallback de antes, só que agora é *fallback*, não o caminho único).
- `POST /api/orders/[id]/location` (`updateOrderLocation`) — prestador reporta lat/lng atuais;
  só o prestador do pedido, só em `ACCEPTED`/`EN_ROUTE` (403/409 fora disso).
- `getOrder`/`GET /api/orders/[id]` — novo campo `tracking` no DTO (`providerLat`/`providerLng`/
  `updatedAt`/`distanceKm`/`etaMin`); quando há posição do prestador, calcula rota real via
  **Valhalla** (`routeBetween`) para preencher distância/ETA — best-effort, sem `VALHALLA_URL`
  (Railway pendente) fica `null` em vez de quebrar a request.

**App:**
- `create-order.tsx` — campo de **CEP** com autofill via **ViaCEP** (API pública, direto do
  device, sem passar pelo backend) preenchendo rua/bairro/cidade/UF.
- `lib/location.ts` (`useShareLocationWhileEnRoute`) — prestador com um pedido `ACCEPTED`/`EN_ROUTE`
  compartilha a posição via `expo-location` (`watchPositionAsync`, foreground only, ~8s/25m) enquanto
  o dashboard está aberto; sem permissão ou fora de um pedido ativo, não faz nada (mesmo padrão
  best-effort do push, RF-E2). Dependência nova `expo-location` + plugin no `app.json`.
- `client/order/[id].tsx` — passou a fazer poll (`useOrder(id, { poll: true })`); botão **"Acompanhar
  no mapa"** quando `ACCEPTED`/`EN_ROUTE` leva pro tracking.
- `client/tracking/[id].tsx` — reescrita para dados reais (`useOrder` com poll de 5s): status/progresso
  vem da máquina de estados de verdade, ETA/distância vêm de `order.tracking` ("Calculando chegada..."
  enquanto não há posição/rota), provider/chat com o `order.id` real. O SVG de rota decorativo foi
  mantido (RF-C2, mapa real via MapLibre, segue fora de escopo deste incremento).

**Verificado E2E** via curl contra o Supabase real (seed + usuário de teste): pedido criado sem
lat/lng → geocoding cai no fallback sem quebrar (`NOMINATIM_URL` ainda não configurada); `accept` →
`start_route` → `POST .../location` grava a posição; guardas **403** (usuário errado), **400**
(corpo inválido), **401** (sem token), **404** (pedido inexistente), **409** (fora de
`ACCEPTED`/`EN_ROUTE`, testado em `IN_PROGRESS`); `GET` do pedido reflete a última posição salva com
`distanceKm`/`etaMin` nulos (sem `VALHALLA_URL`, como esperado). Typecheck web+native limpos.

**Pendências:** ETA/distância real e geocoding de endereço só funcionam de ponta a ponta depois do
deploy da Geo na Railway (ver handoff acima); mapa real (MapLibre + MapTiler, RF-C2) e localização em
background (hoje só enquanto o app está em foco) ficam para depois; `expo-location` exige rebuild
nativo (`expo prebuild`) — mesma pendência de handoff dos incrementos de push/pagamento.

### ✅ Código concluído · ⏳ rebuild nativo — Mapa real (MapLibre + OpenFreeMap, RF-C1/C2)
Sem migração. Troca o backdrop ilustrativo (`MapBackdrop`) por mapa real em todas as telas que
mostravam posição: **Home do cliente**, **Mapa do prestador** e **Tracking**. Tiles via
**OpenFreeMap** (`tiles.openfreemap.org`, MIT, sem chave) no lugar do MapTiler free-tier planejado
originalmente — evita depender de uma chave/conta extra para algo grátis e ilimitado.

**App:**
- `components/ui/real-map.tsx` (`RealMap`) — wrapper do `@maplibre/maplibre-react-native`: câmera
  por `center`/`zoom` ou por `bounds` (enquadra dois pontos, ex. prestador↔cliente), marcadores via
  `render()` (reaproveita `ProviderMarker`/`SelfMarker`, adaptados de posição absoluta `top/left`
  para posição geográfica), rota como `GeoJSONSource`/`Layer` de linha.
- `lib/location.ts` — `useCurrentLocation` (posição atual, uma vez, pro marcador "você está aqui")
  e `useShareLocationWhileEnRoute` (`watchPositionAsync`, foreground, ~8s/25m, só com pedido
  `ACCEPTED`/`EN_ROUTE`) — mesmo padrão best-effort do push (RF-E2): sem permissão, não quebra a
  tela. Wireado no dashboard do prestador e no mapa do prestador.
- `create-order.tsx` — campo **CEP** com autofill via ViaCEP (rua/bairro/cidade/UF), reduz digitação
  antes do geocoding real no servidor (RF-C6, incremento anterior).
- `client/order/[id].tsx` — botão **"Acompanhar no mapa"** quando `ACCEPTED`/`EN_ROUTE`; `useOrder`
  passou a aceitar `{ poll: true }` (refetch 5s só em foco, via `useIsFocused`).
- Config nativa: `@maplibre/maplibre-react-native` + `expo-location` instalados; plugins no
  `app.json` (permissão de localização + plugin do MapLibre); `EXPO_PUBLIC_MAPTILER_KEY` removida
  do `.env.example`/`packages/env` (não é mais necessária).
- Backend (`apps/web/src/lib/geo.ts`) — decodificação da polyline do Valhalla (`decodePolyline6`)
  movida pro servidor: `routeBetween` agora retorna `points: LatLng[]` prontos, evitando levar um
  parser de polyline pro bundle nativo; `OrderDTO.tracking.route` carrega essa geometria pro
  `RealMap` desenhar a rota real quando a Geo (Railway) estiver no ar.

**Verificado:** `tsc --noEmit` limpo em `apps/native` e `apps/web`; `prisma db push` confirma que o
schema (campos de tracking do incremento anterior) já está em sync com o Supabase; dependências
nativas presentes em `node_modules`/`pnpm-lock.yaml`.

**Pendências:** `@maplibre/maplibre-react-native` e `expo-location` alteram código nativo — precisa
de `expo prebuild` + rebuild (mesma pendência de handoff dos incrementos de push/pagamento/tracking)
para ver o mapa de verdade num device; até lá, a lógica de dados (posição, rota, ETA) já roda, só a
renderização do mapa não foi validada visualmente.

### ✅ Rebuild nativo iOS validado no simulador — build Xcode + boot do app

`apps/native/ios` e `android/` já existiam no working tree (gerados por `expo prebuild` numa sessão
anterior, gitignored) com Pods já instalados. Rodei `npx expo run:ios --device <iPhone 17 simulator>`:
build do Xcode (`xcodebuild ... judeu.xcworkspace`) terminou com **0 erros**, o app foi instalado e
aberto no simulador, subindo a tela de onboarding (**"Ajuda+ — Encontre quem resolve"**) normalmente —
primeira confirmação real de que o prebuild com MapLibre/Stripe/push/location compila e roda. Subi
também o backend (`apps/web`, porta 3001) e o Metro (porta 8082, porta 8081 já ocupada por outro
projeto na máquina) em background; criei um usuário de teste (`teste.cliente@ajuda.app` /
`teste12345`) via `/api/auth/register` para login manual. `tsc --noEmit` do native seguiu limpo.

**Bloqueio:** não tenho permissão de Acessibilidade no macOS pra simular toques na tela (osascript
recusou `keystroke`, sem `cliclick`/`idb` instalados) — não deu pra navegar sozinho até a Home/mapa
pra confirmar visualmente o MapLibre renderizando. Você decidiu encerrar por aqui; o app segue no ar
no simulador (Metro + backend rodando) caso queira entrar com o usuário de teste acima e conferir.

---

## 7. Próximos blocos sugeridos (P0 pendentes)

1. **Deploy da Geo na Railway (handoff com você, ver seção 6)** — sem isso, o código de geocoding
   (RF-C6) e ETA/distância (RF-C5, RF-E3) já pronto continua caindo nos fallbacks/`null`. Não dá pra
   avançar isso sem sua conta Railway; também não deu pra sequer validar os Dockerfiles localmente
   porque a máquina não tem Docker instalado (o README de `apps/geo` documenta esse teste local
   opcional, com um PBF pequeno, se quiser rodar você mesmo).
2. **Rebuild nativo** — build+boot no simulador iOS **já validado nesta sessão** (ver log acima);
   falta rodar num **device físico** (câmera/GPS/push reais) e no **Android**, além de navegar
   manualmente pelas telas de mapa/tracking pra conferir o MapLibre, localização, push e o
   `PaymentSheet` do Stripe na prática.

Com isso, o punchlist de código P0 do roadmap (seção 5) fica completo — o que resta são handoffs de
infraestrutura/conta que só você pode fazer (Railway, EAS, Supabase Storage, Stripe Pix, device
físico/Android).

---

## 8. Referências no repositório
- Guia técnico do LLM on-device: [apps/native/docs/react-native-executorch-guide.md](../apps/native/docs/react-native-executorch-guide.md)
- Planejamento da busca por IA: [apps/native/docs/ai-search-planning.md](../apps/native/docs/ai-search-planning.md)
- Checklist de cobertura: confrontar cada campo mockado em `apps/native/lib/mock-data.ts` com o dado real correspondente.
