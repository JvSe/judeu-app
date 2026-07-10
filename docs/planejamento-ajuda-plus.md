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
| **Notificações push (novo pedido, updates, mensagens)** | RF-E2 | ✅ **Concluído** · projeto EAS vinculado (`eas init`) · falta testar token real em device físico |
| **Painel admin (moderação de KYC)** | RF-H3 | ✅ **Concluído** |
| **Tracking em tempo real (posição do prestador + ETA)** | RF-E3 | ✅ **Código concluído** · ETA real depende do deploy Railway (Valhalla) |
| **Mapa real (MapLibre + tiles OpenFreeMap)** | RF-C1/C2 | ✅ **Código concluído** · rebuild nativo (`expo prebuild` + build Xcode) validado no simulador iOS — app abre normal; render visual do mapa (por trás do login) ainda não conferida |
| **Centro de notificações in-app + preferências por evento** | RF-I1 | ✅ **Concluído** |
| **Termos & LGPD (consentimento, exclusão/exportação de conta, permissões reais)** | RNF-4/5, RF-A7 | ✅ **Concluído** |
| **Testes automatizados + CI** | RNF-8 | ✅ *unitários + CI · lint (ESLint) pendente* |
| **Edição de perfil (dados, foto, endereços)** | RF-A6, RF-C6 (múltiplos endereços) | ✅ *foto pendente ativação do Storage* |
| **Central de ajuda/suporte + disputas (FAQ, chamados, moderação admin)** | RF-H1, RF-H2 | ✅ **Concluído** |

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
- **RF-A4 (P1)** Recuperação de senha. — ✅ *código de 6 dígitos; "envio" por e-mail best-effort (log no servidor, sem provedor real ainda)*
- **RF-A5 (adiado)** Login social: só os botões na UI, sem função (Apple Sign-In será exigência da App Store se ativado).
- **RF-A6 (P1)** Edição de perfil (foto via Storage, dados, endereço). — ✅ *foto pendente ativação do Storage, mesmo padrão do KYC*
- **RF-A7 (P2)** Exclusão de conta e exportação de dados (LGPD/lojas). — ✅

### RF-B · Onboarding e Verificação do Prestador (KYC)
- **RF-B1 (P0)** Cadastro profissional (categorias, serviços, preços, área/raio). — ✅
- **RF-B2 (P0)** Verificação de identidade (documento/CPF) antes de aparecer para clientes. — ✅ *upload de documento; conta Supabase Storage pendente ativação*
- **RF-B3 (P1)** Status de aprovação (pendente/aprovado/bloqueado) + moderação. — ✅ *status real (PENDING ao nascer, gate no catálogo) + moderação via painel admin (RF-H3)*
- **RF-B4 (P1)** Disponibilidade on/off. — ✅
- **RF-B5 (P2)** Portfólio (fotos) e certificações por categoria.

### RF-C · Descoberta, Busca e Geolocalização
- **RF-C1 (P0)** Localização real do dispositivo. — ✅ *(`expo-location`, foreground)*
- **RF-C2 (P0)** Mapa real (MapLibre + tiles OpenFreeMap). — ✅ *código pronto; rebuild nativo pendente pra verificar em device*
- **RF-C3 (P0)** Consulta de prestadores no Supabase por categoria/serviço + geo — alimenta mapa e IA. — ✅
- **RF-C4 (P1)** Filtros/ordenação tradicionais (fallback à IA). — *fallback em uso na Explorar*
- **RF-C5 (P1)** Distância/ETA real via Valhalla. — ✅ *código pronto (rota prestador→endereço); ETA real depende do deploy Railway*
- **RF-C6 (P2)** Busca por endereço/CEP (ViaCEP + Nominatim) + múltiplos endereços. — ✅ *ViaCEP no cadastro do pedido; geocoding Nominatim no servidor (fallback pro centro de Palmas sem Railway); múltiplos endereços agora têm livro de endereços real (RF-A6) — só não estão integrados de volta ao formulário de pedido (`create-order.tsx` continua com endereço avulso)*

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
- **RF-D6 (P1)** Agendamento (data/hora futura). — ✅
- **RF-D7 (P1)** Histórico de pedidos. — ✅ (em andamento × concluídos)
- **RF-D8 (P2)** Recontratar/repetir pedido; favoritos.

### RF-E · Comunicação em tempo real
- **RF-E1 (P0)** Chat cliente↔prestador real (persistido, entregue/lido). — ✅
- **RF-E2 (P0)** Notificações push (novo pedido, updates, mensagens). — ✅ *projeto EAS vinculado (`eas init`); falta confirmar token real num device físico*
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
- **RF-H1 (P1)** Central de ajuda/suporte (FAQ, chamado). — ✅ *FAQ real + abertura/acompanhamento de chamados*
- **RF-H2 (P1)** Fluxo de disputa/contestação. — ✅ *chamado vinculado a um pedido (categoria Disputa), sem fluxo de retenção de valor*
- **RF-H3 (P1)** Painel administrativo (web, `apps/web`). — ✅ *moderação de KYC (fila + aprovar/bloquear) + chamados de suporte (responder/resolver)*
- **RF-H4 (P2)** Anti-fraude/abuso.

### RF-I · Notificações e Preferências
- **RF-I1 (P1)** Centro de notificações in-app + preferências por evento. — ✅
- **RF-I2 (P2)** i18n (hoje pt-BR hardcoded).

---

## 3. Requisitos Não-Funcionais

- **RNF-1 · Supabase (P0):** schema modelado (User, Provider, Service, Category, Order, Review, etc.), Storage, RLS por papel, cliente de dados no app. — ✅ *(13 tabelas + auth)*
- **RNF-1b · Infra de IA (P0):** orquestração do assistente. — ✅ *revisado para on-device (sem servidor/chave); ver [ai-search-planning](../apps/native/docs/ai-search-planning.md)*
- **RNF-2 · Estado/dados no app (P0):** TanStack Query + sessão/auth. — ✅
- **RNF-3 · Segurança (P0):** hash de senha, tokens/refresh, secure-store, validação, rate limiting, endpoints por papel. — ✅ *(base)*
- **RNF-4 · Privacidade/LGPD (P0):** consentimento, política/termos, exclusão/exportação, minimização de localização. — ✅ *minimização de localização já valia (só compartilha durante atendimento ativo, foreground)*
- **RNF-5 · Permissões do device (P0):** localização, notificações, câmera/galeria com justificativas. — ✅ *status real na tela de privacidade; justificativas já existiam nos plugins do `app.json`*
- **RNF-6 · Confiabilidade/tempo real (P1):** push (Expo) — ✅ *projeto EAS vinculado*; WebSocket, reconexão, offline.
- **RNF-7 · Observabilidade (P1):** logs, Sentry, analytics de funil.
- **RNF-8 · Qualidade (P1):** testes, CI, lint/typecheck no `turbo.json`, tipagem ponta-a-ponta. — ✅ *testes unitários (Vitest) + CI (GitHub Actions) + `check-types` real em `web`/`native`; lint segue pendente (sem ESLint configurado ainda)*
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
| **Perfil Cliente** `client/(tabs)/profile.tsx` | Estático | RF-A6 ✅/A2 ✅/A7 ✅, RF-C6 ✅, RF-I1 ✅ |
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
Login/Cadastro/OTP (RF-A1/A2) · Recuperação de senha (RF-A4, ✅) · Busca por IA (RF-J, ✅ na Explorar) · Onboarding Prestador/KYC (RF-B1/B2/B3, ✅ · RF-B5 pendente) · Criar/Configurar Pedido (RF-D1/D5/D6, ✅ base) · Detalhe do Pedido/Estados (RF-D2/D4/D7, ✅) · Avaliação pós-serviço (RF-G1/G2, ✅) · Push (RF-E2, ✅ código) · Painel Admin (RF-H3, ✅) · Centro de Notificações in-app (RF-I1, ✅) · Suporte/Disputa (RF-H1/H2, ✅) · Termos & Permissões (RNF-4/5, ✅) · Anti-fraude/abuso (RF-H4, RNF-7).

---

## 5. Roadmap (priorização)

1. **Fundação (P0):** Supabase + Storage + RLS (RNF-1), Auth (RF-A1..A3), estado/dados (RNF-2), segurança (RNF-3), LGPD/permissões (RNF-4/5), infra de IA (RNF-1b). — ✅ *(núcleo)*
2. **Núcleo do marketplace (P0):** KYC (RF-B1/B2) ✅, localização+mapa (RF-C1..C3), **IA conversacional (RF-J)** ✅, pedido+estados (RF-D1..D4) ✅, pagamento (RF-F1..F3), chat (RF-E1) ✅ + push (RF-E2) ✅, avaliação (RF-G1) ✅.
3. **Confiança e financeiro (P1):** histórico (RF-D7) ✅, carteira (RF-F4/F5) ✅ · reembolso (RF-F6) ✅, tracking (RF-E3), avaliações no perfil (RF-G2) ✅, suporte/disputa (RF-H1/H2) ✅, admin (RF-H3) ✅, observabilidade/testes (RNF-7/8).
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

**Pendência:** avaliação **prestador → cliente** existe no backend, falta a tela do lado do prestador
(ver incremento abaixo, já resolvido); gorjeta (RF-F7) removida da UI (depende de pagamento).

### ✅ Incremento — Avaliação do cliente pelo prestador (RF-G1, lado prestador)
Sem migração e sem mudança de backend — `createReview`/`getMyReview` (`apps/web/src/lib/reviews.ts`)
já eram genéricos (avaliam sempre "a outra parte" do pedido), só faltava a tela do lado do
prestador para chamar essa API.

**App:** nova tela `provider/rating/[id].tsx` — mesmo padrão visual/estrutural da avaliação do
cliente (estrelas, tags, comentário, estado "já avaliado"), com tags trocadas para o contexto de
avaliar um cliente (Pontual/Educado/Ambiente organizado/Pagamento em dia) e navegação de volta ao
dashboard do prestador em vez de "Meus pedidos"; registrada em `provider/_layout.tsx`. **Dashboard
do prestador** (`provider/(tabs)/index.tsx`) ganhou seção **Concluídos** (pedidos `COMPLETED`, até
10 mais recentes) com CTA "★ avaliar" levando à nova tela — antes não havia nenhum jeito de chegar
lá a partir do app do prestador.

**Verificado:** `tsc --noEmit` do native limpo (rodado depois de regenerar os tipos de rota do Expo
Router para a nova tela `provider/rating/[id]`, mesmo passo do incremento de recuperação de senha).

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

### ✅ Incremento — Agendamento (RF-D6) + Disponibilidade on/off do prestador (RF-B4)
Primeiro bloco de **P1** (produto sério/confiável) — os dois itens já eram só "pendências pequenas"
citadas no roadmap. Sem migração (`Order.scheduledAt` e `ProviderProfile.isAvailable` já existiam no
schema; o backend de `scheduledAt` já aceitava o campo desde o incremento de pedido, só a UI nunca
enviava data).

**RF-D6 — Agendamento:**
- **App** (`client/create-order.tsx`): campos de **data** (`DD/MM/AAAA`) e **hora** (`HH:MM`) com
  máscara, exibidos só quando o toggle "Agendar" está ativo; valida data/hora completas e no futuro
  antes de enviar `scheduledAt` (ISO) — "Agora" continua omitindo o campo (`undefined` = imediato,
  mesma semântica que já existia no backend).
- **Detalhe do pedido** (`client/order/[id].tsx`) — card "Agendado para {data}" quando `scheduledAt`
  existe, usando o helper `shortDateTime` já presente em `lib/format.ts`.
- **Dashboard do prestador** (`provider/(tabs)/index.tsx`) — chip "Agendado para {data}" nos cards de
  "Novos pedidos", pra diferenciar de pedidos imediatos.
- **Backend** (`apps/web/src/lib/orders.ts`) — título do push pro prestador vira "Novo pedido
  agendado" quando `scheduledAt` está presente (antes sempre "Novo pedido").

**RF-B4 — Disponibilidade on/off:**
- **Backend**: `setProviderAvailability` (`apps/web/src/lib/provider-profile.ts`) + rota nova
  `POST /api/providers/me/availability` (`{ isAvailable: boolean }`, só `PROVIDER`/`BOTH`, não exige
  `APPROVED`); `isAvailable` passou a fazer parte de `MyProviderProfileDTO`. `catalog.ts`
  (`listProviders`/`getProvider`) passou a expor `isAvailable` no DTO público — **sem** filtrar o
  catálogo por isso (decisão: prestador offline continua listado, já que o app suporta "Agendar" pra
  depois; só muda o badge visual). Seed já cadastra os 3 prestadores com `isAvailable: true`, então o
  catálogo não regrediu.
- **App**: `useSetAvailability` (`lib/hooks.ts`); no **dashboard do prestador**, o chip estático
  "Ativo" virou toggle real (`Pressable`) mostrando "Disponível"/"Offline" e chamando a API; no
  **detalhe do prestador** (`client/provider/[id].tsx`) e nos **cards do assistente de IA**
  (`components/ai-assistant.tsx`), badge/dot de disponibilidade visível ao cliente.

**Verificado E2E** via curl contra o Supabase real: disponibilidade — 200 criando profile vazio no
primeiro toggle, 403 pra `CLIENT`, 401 sem token, 422 payload inválido, toggle on→off refletido no
`GET /api/providers/me` seguinte; agendamento — pedido com `scheduledAt` futuro grava e retorna o
campo (201), pedido sem o campo grava `null` (comportamento "agora" preservado), data inválida
rejeitada. Catálogo (`GET /api/providers`) confirma `isAvailable: true` nos 3 prestadores seedados
(sem regressão). Typecheck web+native limpos.

### ✅ Incremento — Recuperação de senha (RF-A4)
Migração: novo model `PasswordResetToken` (`id`, `userId`, `tokenHash` único, `expiresAt`, `usedAt`,
`createdAt`) — mesmo padrão do `RefreshToken` já existente (token opaco, só o hash fica no banco).
Sem provedor de e-mail real configurado (mesma situação de infra pendente do Storage/Railway/EAS):
o "envio" é best-effort via `apps/web/src/lib/mailer.ts` (`sendEmail`), que por ora só loga no
console do servidor — troca por um provedor real (Resend, SES etc.) é só reescrever essa função.

**Backend** (`apps/web/src/lib/auth.ts` + rotas `apps/web/src/app/api/auth/{forgot,reset}-password`):
- `issuePasswordResetCode(userId)` — código numérico de 6 dígitos (`crypto.randomInt`), hash
  `sha256(userId:code)` persistido com TTL de 15min; invalida (marca `usedAt`) qualquer código
  anterior ainda não usado do mesmo usuário antes de criar um novo.
- `consumePasswordResetCode(userId, code)` — valida hash/expiração/uso único; marca `usedAt` ao
  aceitar (não pode ser reaproveitado).
- `revokeAllRefreshTokens(userId)` — nova função em `auth.ts`, derruba todas as sessões ativas do
  usuário (chamada no reset, por segurança — força novo login em outros dispositivos).
- `POST /api/auth/forgot-password` — **sempre** responde `200 {ok:true}`, exista ou não a conta
  (evita enumeração de e-mail, mesmo padrão do login); se existir, gera o código e loga via mailer.
- `POST /api/auth/reset-password` — valida `{email, code, newPassword}`; código errado/expirado e
  e-mail inexistente retornam a **mesma** mensagem genérica (400); ao aceitar, troca a senha
  (`bcrypt`), revoga todas as sessões antigas e já devolve um par de tokens novo — mesma forma de
  `AuthResponse` do login/registro (auto-login, sem tela extra de "faça login de novo").

**App:** `authApi.forgotPassword`/`resetPassword`; `useAuth().resetPassword` (novo método no
`auth-context.tsx`, espelha `signIn`/`signUp` — salva tokens, atualiza sessão, sincroniza push);
duas telas novas em `app/(auth)/`: **Esqueci minha senha** (só e-mail) e **Confirmar código e nova
senha** (código de 6 dígitos + nova senha + confirmação), registradas no `Stack` de `(auth)/_layout.tsx`;
o texto estático "Esqueci minha senha" do login virou link de verdade. (A tela `otp.tsx` do
protótipo original — verificação de SMS por telefone, RF-A1 — segue 100% mock e fora de escopo
deste incremento; é um fluxo diferente do reset por e-mail.)

**Verificado E2E** via curl contra o Supabase real: `forgot-password` sempre `200` (conta existente e
inexistente, sem diferença observável); código aparece no log do servidor (`[mailer] ...`); código
errado → `400`; payload inválido (código com 5 dígitos) → `422`; código certo → `200` com tokens
novos; **reuso do mesmo código falha** (`400`, confirma consumo único); login com a senha antiga →
`401`; login com a senha nova → `200`; refresh token emitido **antes** do reset falha depois (`401`,
confirma que `revokeAllRefreshTokens` derrubou a sessão antiga). Regeneração dos tipos de rota do
Expo Router (`.expo/types/router.d.ts`, gitignored) rodada localmente pras duas telas novas
tipar certo. Typecheck web+native limpos.

### ✅ Incremento — Projeto EAS vinculado (`eas init`, RF-E2)

Rodei `eas init --force` (você já estava logado no EAS CLI como `nextmed`) — criou o projeto
[`@nextmed/judeu`](https://expo.dev/accounts/nextmed/projects/judeu) e gravou `extra.eas.projectId`
(`422fcb7a-6da6-47c4-908c-727b03b2ce12`) + `owner: "nextmed"` em `apps/native/app.json`. Isso é
config JS/`expo-constants` (não código nativo), então **não deveria exigir rebuild** — o dev client
já buildado nesta sessão (simulador iOS) deve conseguir gerar um push token real só reabrindo o app.

**Efeito colateral notado e corrigido:** o comando também resolveu/sincronizou `android.permissions`,
adicionando `android.permission.RECORD_AUDIO` (`ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION` já
eram esperadas do `expo-location`) — o plugin do `expo-image-picker` inclui essa permissão por
padrão (`microphonePermission` não setado), mesmo o app não usando áudio em lugar nenhum. Adicionado
`"microphonePermission": false` na config do plugin em `app.json` (RNF-5, minimização de permissão).
**A pasta `android/` já prebuilada (gitignored) ainda tem o `RECORD_AUDIO` no `AndroidManifest.xml`
de uma sessão anterior** — só sai de fato depois do próximo `expo prebuild`, que já é pendência
conhecida (item 2 abaixo).

**Pendência:** ainda falta abrir o app (simulador ou device) depois dessa mudança e confirmar que
`getExpoPushTokenAsync` retorna um token de verdade (ver dashboard do Expo em
expo.dev/accounts/nextmed/projects/judeu) — não tentei automatizar isso porque exige interação manual
no dispositivo (mesmo bloqueio de Acessibilidade no macOS já registrado no incremento do build Xcode).

### ✅ Incremento — Centro de notificações in-app + preferências por evento (RF-I1)

Primeiro bloco de **P1** implementado a partir de código (não handoff de infra). Migração: novo
model `Notification` (`id`, `userId`, `type: NotificationType` [`ORDER`/`MESSAGE`], `title`, `body`,
`data Json?`, `readAt`, `createdAt`) + dois novos campos em `User` (`notifyOrders`/`notifyMessages`,
ambos `Boolean @default(true)`).

**Backend** (`apps/web/src/lib/notifications.ts` + rotas `apps/web/src/app/api/notifications/*`):
- `notifyUser(userId, type, payload)` — nova função central de disparo de notificação: checa a
  preferência do usuário pro tipo (`notifyOrders`/`notifyMessages`); se desligada, não persiste nem
  dispara push; se ligada, grava a `Notification` e chama `sendPushNotification` (a função de push
  do incremento RF-E2 não mudou, só passou a ser chamada por trás de `notifyUser`). Fire-and-forget
  (`void`) nos call sites, mesmo padrão best-effort do push — nunca derruba criar pedido/transição/
  mensagem.
- `orders.ts` (`createOrder`, `transitionOrder`) e `chat.ts` (`sendMessage`) trocaram a chamada direta
  a `sendPushNotification` por `notifyUser(..., "ORDER" | "MESSAGE", ...)` — nenhuma outra mudança de
  comportamento nesses fluxos.
- `GET /api/notifications` — últimas 50 notificações do usuário + `unreadCount`.
- `POST /api/notifications/read-all` — marca todas como lidas ("Marcar lidas" no centro).
- `POST /api/notifications/[id]/read` — marca uma notificação como lida (403/404 se não for do
  usuário — na prática 404 pra não vazar existência do id de outro usuário).
- `GET/POST /api/notifications/preferences` — lê/atualiza `notifyOrders`/`notifyMessages`.

**App:** `notificationsApi` + hooks (`useNotifications` com poll opcional em foco, mesmo padrão do
chat; `useMarkNotificationRead`/`useMarkAllNotificationsRead`/`useNotificationPreferences`/
`useSetNotificationPreferences`); nova função compartilhada `lib/notifications.ts`
(`pathForNotification`) que decide pra onde navegar a partir do `data` da notificação (pedido do
cliente, dashboard do prestador ou chat) — extraída do handler de tap em push já existente no
`_layout.tsx` (RF-E2) pra ser reaproveitada também no centro de notificações, sem duplicar a lógica.

Duas telas do **protótipo original que eram 100% mock** (`mock-data.ts`, array `notifications`)
viraram reais: `client/notifications.tsx` (reescrita) e `provider/notifications.tsx` (nova, mesmo
padrão visual, registrada em `provider/_layout.tsx`) — cada uma com: filtro Todas/Pedidos/Mensagens,
lista agrupada por dia ("HOJE"/"ONTEM"/data, novo helper `dateGroupLabel` em `lib/format.ts`), tempo
relativo (`relativeTime`, novo helper), tap marca como lida e navega pro destino, botão "Marcar
lidas", e um cartão de preferências (2 toggles: Pedidos/Mensagens) no topo. O sino da Home do
cliente e um sino novo no dashboard do prestador (`headerRow`, ao lado do toggle Disponível/Offline)
passaram a mostrar um badge real (`unreadCount > 0`) em vez do ponto estático sempre visível que
havia antes. O array `notifications`/tipos `NotificationGroup`/`NotificationTone` foram removidos de
`mock-data.ts` (última tela que os usava).

**Verificado E2E** via curl contra o Supabase real (usuário `teste.cliente@ajuda.app` + prestador
seed `carlos.mendes@ajuda.app`): pedido criado → notificação `ORDER` persistida pro prestador
(`unreadCount: 1`, `data` com `orderId`/`role` corretos); marcar como lida por outro usuário → `404`;
pelo dono → `200` e `unreadCount` cai pra 0; desligar `notifyMessages` do prestador → mensagem do
chat não gera notificação nem push (nenhuma entrada nova); religar → mensagem seguinte gera
`MESSAGE` normalmente; `read-all` zera `unreadCount`; preferências com payload vazio → `422`; rotas
sem token → `401`. Typecheck web (`tsc --noEmit`) e native limpos.

**Pendências:** sem migração de dados — usuários existentes já nascem com as duas preferências
`true` (default do schema); sem paginação além do `take: 50` (suficiente por ora, RNF-11 fica pra
quando o volume justificar); o badge do sino usa fetch simples (sem poll) na Home/dashboard — só a
tela do centro de notificações faz poll (8s, só em foco).

### ✅ Incremento — Termos & LGPD: consentimento, exclusão/exportação de conta, permissões reais (RNF-4/5, RF-A7)

Migração: `User.termsAcceptedAt` (`DateTime?`, carimbado no cadastro) e `User.deletedAt`
(`DateTime?`, marca a conta como excluída sem quebrar FKs de `Order`/`Review`/`Message` que outras
pessoas ainda precisam ver no histórico delas).

**Backend:**
- `POST /api/auth/register` passou a exigir `acceptedTerms: true` no corpo (422 sem isso) e grava
  `termsAcceptedAt`.
- `apps/web/src/lib/account.ts` (novo) — `deleteAccount(userId)`: **anonimiza** em vez de apagar a
  linha — troca `email` por `deleted-<uuid>@ajuda.app` (libera o e-mail original pra um cadastro
  novo), `fullName` por "Usuário excluído", zera `phone`/`avatarUrl`/`pushToken`, troca
  `passwordHash` por um hash de senha aleatória inutilizável, e derruba todas as sessões
  (`revokeAllRefreshTokens`); se a conta tem `ProviderProfile`, marca `BLOCKED`/`isAvailable: false`
  e limpa `headline`/`bio` (some do catálogo). Pedidos, avaliações e mensagens continuam intactos —
  são histórico legítimo da outra parte, só deixam de identificar quem foi excluído.
  `exportAccountData(userId)` — dump de tudo que a conta gerou (perfil, endereços, pedidos como
  cliente/prestador, avaliações, mensagens, carteira, notificações) pra portabilidade.
- `DELETE /api/auth/me` e `GET /api/auth/me/export` — novas rotas, ambas autenticadas.

**App:**
- `client/(auth)/signup.tsx` — o checkbox de aceite deixou de vir **pré-marcado** (`useState(true)`
  → `useState(false)`, consentimento explícito de verdade) e "Termos de uso"/"Política de
  privacidade" viraram links reais; `signUp()` manda `acceptedTerms: true`.
- Duas telas de conteúdo novas, reais (não placeholder): `app/terms.tsx` e `app/privacy-policy.tsx`
  — registradas na **raiz** do Stack (`app/_layout.tsx`), não em `client/`, porque precisam abrir a
  partir do cadastro **antes** do login (a guarda de autenticação do `client/_layout.tsx` barraria
  isso). Layout compartilhado extraído em `components/ui/legal-screen.tsx` (só o texto muda entre
  as duas).
- `client/privacy.tsx` reescrita — era 100% mock (toggles em `useState` local que não liam nem
  mudavam nada de verdade, botão "Excluir minha conta" sem ação). Agora: status real das 3
  permissões que o app de fato usa (localização, notificações, câmera — via
  `getForegroundPermissionsAsync`/`getPermissionsAsync`/`getCameraPermissionsAsync`); toque **pede**
  a permissão se ainda não foi decidida, ou abre o **Settings do sistema** (`Linking.openSettings`)
  se já concedida (o app não pode revogar uma permissão do usuário, só o SO permite isso); removido
  o toggle de "Microfone" (o app não usa áudio em lugar nenhum — coerente com o
  `microphonePermission: false` do incremento do `eas init`). "Baixar meus dados" chama
  `GET /api/auth/me/export` e abre o share sheet nativo (`Share.share`, API do próprio React Native
  — evitou instalar `expo-sharing`, que exigiria mais um rebuild nativo); "Excluir minha conta" pede
  confirmação (`Alert.alert`, destrutivo) antes de chamar `DELETE /api/auth/me` e desloga de verdade.
- **Bug encontrado e corrigido nessa varredura:** "Sair da conta" no perfil do cliente
  (`client/(tabs)/profile.tsx`) só navegava pra `/` sem nunca chamar `signOut()` — a sessão
  (tokens + estado de auth) continuava viva; corrigido pra deslogar de verdade antes de navegar.

**Verificado E2E** via curl contra o Supabase real: registro sem `acceptedTerms`/com `false` → `422`
nos dois; com `true` → `201`; `GET /api/auth/me/export` sem token → `401`, com token → dump correto
da conta; `DELETE /api/auth/me` sem token → `401`, com token → `200`; login com a senha antiga da
conta excluída → `401` (falha, como esperado); **novo cadastro com o mesmo e-mail da conta excluída**
→ `201` (confirma que o e-mail foi liberado pela anonimização). Typecheck web+native limpos.

**Pendências:** conteúdo dos Termos/Política é texto real e específico do que o app faz, mas não
passou por revisão jurídica formal — recomendo validar com um advogado antes de publicar nas lojas;
um access token (JWT) emitido **antes** da exclusão continua válido até expirar (15min) mesmo
depois — mesma janela de tolerância que o resto da autenticação já aceita (stateless, sem checar o
banco a cada request); storage do documento de KYC (Supabase Storage) não é apagado na exclusão —
seguem a mesma pendência de ativação da conta Storage já registrada no incremento de KYC.

### ✅ Incremento — Testes automatizados + CI (RNF-8)

Zero cobertura de teste e zero CI antes deste incremento — `turbo.json` já tinha as tarefas
`lint`/`check-types` declaradas, mas **nem `apps/web` nem `apps/native` tinham o script
`check-types` no próprio `package.json`**, então `pnpm check-types` da raiz rodava só o
`@judeu/ui` silenciosamente, sem avisar que os dois apps principais estavam de fora — bug real
encontrado e corrigido (adicionado `check-types` nos dois).

**Framework:** Vitest (catalogado em `pnpm-workspace.yaml` como as demais libs compartilhadas),
com `vitest.config.ts` próprio em `apps/web` (alias `@` -> `src`) e `apps/native` (alias `@` ->
raiz do app), cada um só resolvendo os `*.test.ts` do seu workspace.

**O que ganhou teste** (só lógica pura/schemas — sem mockar Prisma nem subir banco de teste, ver
pendência abaixo):
- `apps/web/src/lib/user.test.ts` — `roleSchema`, e que `publicUser()` nunca vaza `passwordHash`.
- `apps/web/src/lib/orders.test.ts` — a tabela `TRANSITIONS` (máquina de estados do pedido)
  exportada pra teste: espelha o fluxo documentado, nenhuma transição sai de um estado terminal
  (`COMPLETED`/`CANCELLED`), nenhuma é reflexiva, só `client`/`provider` disparam ação, e só
  `cancel` é do cliente; `PLATFORM_FEE_RATE` (8%) batendo com o exemplo já verificado manualmente
  em incremento anterior (R$60 → taxa R$4,80 → total R$64,80).
- `apps/web/src/lib/geo.test.ts` — `decodePolyline6` (decodificador de polyline do Valhalla,
  exportado pra teste): string vazia, ponto na origem, e o **exemplo canônico do algoritmo de
  polyline do Google** (`_p~iF~ps|U_ulLnnqC_mqNvxq\`@` → 3 pontos), ajustado pra precisão 1e6 que
  o projeto usa (1e5 no exemplo oficial).
- `apps/web/src/app/api/auth/register/route.test.ts` e
  `.../notifications/preferences/route.test.ts` — os schemas Zod inline dessas rotas foram
  exportados (`registerSchema`, `notificationPreferencesSchema`) pra testar as regras de validação
  direto, sem subir o Next.js: `acceptedTerms` tem que ser `true` (RNF-4), preferências não podem
  vir com os dois campos ausentes, etc.
- `apps/native/lib/format.test.ts` — todos os helpers de formatação (`initialsOf`,
  `priceFromCents`, `moneyFromCents`, `orderStatusLabel`/`isOrderActive`, `shortTime`/
  `shortDateTime`, e os dois novos do incremento de notificações, `relativeTime`/
  `dateGroupLabel`, com `vi.useFakeTimers()` pra fixar "agora" e evitar teste flaky por fuso
  horário).
- `apps/native/lib/notifications.test.ts` — `pathForNotification` nos 6 casos (chat/pedido ×
  cliente/prestador × sem orderId/type).

**CI** (`.github/workflows/ci.yml`, novo): dispara em push pra `main` e em pull requests;
`pnpm install --frozen-lockfile` → `pnpm check-types` → `pnpm test`. Usa env vars **fake** (não os
segredos reais do `.env`) só pra `@judeu/env` conseguir validar o schema na hora de importar os
módulos — os testes são unitários e não abrem conexão de verdade com Supabase/Stripe.

**Verificado:** `pnpm check-types` e `pnpm test` (via turbo, na raiz) — 3 pacotes cada, todos
passando; **51 testes** no total (27 web + 24 native), todos verdes, incluindo o vetor do polyline
que bati manualmente bit a bit contra o algoritmo antes de rodar (bateu de primeira).

**Pendências:** lint (ESLint) não foi configurado — o repo nunca teve nenhum arquivo de config, e
decidir o conjunto de regras (quão estrito, React Native + Next.js) é uma escolha de produto que
prefiro alinhar com você antes de aplicar (pode gerar centenas de avisos no código já existente);
cobertura ainda não chega nas rotas que tocam o banco (`createOrder`, `transitionOrder`,
`deleteAccount` etc.) — isso exigiria mockar o Prisma ou provisionar um banco de teste dedicado
(hoje só existe o Supabase de desenvolvimento, o mesmo usado pra verificação manual); `pnpm build`
não entrou no CI porque exige segredos reais (Stripe, Supabase, JWT de produção) como secrets do
GitHub Actions — configuração de conta, mesmo padrão dos outros handoffs de infra.

### ✅ Incremento — Edição de perfil: dados, foto, livro de endereços (RF-A6, RF-C6)

A tela **Perfil do cliente** era 100% mock — nome "João Silva" fixo, "Membro desde 2024" fixo, stats
fake ("12 Serviços", "4.9 ★ Como cliente", "3 Favoritos" sem favoritos existir como feature), botão
"Sair da conta" já corrigido num incremento anterior, e os menus "Meus endereços"/"Formas de
pagamento"/"Prestadores favoritos" sem nenhum destino (`href` ausente). Sem migração — `User.
fullName/phone/avatarUrl` e o model `Address` já existiam; só nunca tinham CRUD nem UI de gestão
fora do fluxo de criar pedido (que sempre cria um `Address` novo, avulso).

**Backend:**
- `apps/web/src/lib/user.ts` — `PublicUser`/`publicUser()` ganharam `createdAt` (pro "Membro desde
  {ano}" real).
- `apps/web/src/lib/profile.ts` (novo) — `updateProfile` (nome/telefone), `updateAvatar` (sobe a
  foto e grava a URL), `getClientStats` (pedidos concluídos + nota média recebida **como cliente**
  — `Review` onde `targetId = userId` e `order.clientId = userId`; diferente do prestador, o cliente
  não tem coluna agregada própria, calculado na hora só pra essa tela).
- `apps/web/src/lib/storage.ts` — novo `uploadAvatar`, bucket **público** `avatars` (diferente do
  `kyc-documents`, privado — a foto de perfil é vista por outros usuários), retorna a URL pública
  (não só o path).
- `apps/web/src/lib/addresses.ts` (novo) — CRUD completo do livro de endereços: `listAddresses`
  (padrão primeiro), `createAddress` (geocodifica via Nominatim igual ao pedido, mesmo fallback pro
  centro de Palmas; primeiro endereço da conta vira padrão automaticamente), `updateAddress`,
  `deleteAddress` (promove outro a padrão se apagar o que era padrão), `setDefaultAddress`
  (transação: desliga o padrão anterior, liga o novo). `FALLBACK_LAT`/`FALLBACK_LNG` exportados de
  `orders.ts` pra não duplicar os números mágicos.
- Rotas: `PATCH /api/auth/me`, `POST /api/auth/me/avatar`, `GET /api/auth/me/stats`,
  `GET/POST /api/addresses`, `PATCH/DELETE /api/addresses/[id]`, `POST /api/addresses/[id]/default`.

**App:**
- `components/ui/avatar.tsx` — passou a aceitar `imageUri` opcional (`Image` real quando presente,
  cai pras iniciais senão); antes só renderizava iniciais, `avatarUrl` existia no tipo mas nunca era
  usado em lugar nenhum da UI.
- `lib/auth-context.tsx` — novo `updateUser()` no contexto, pra sincronizar o usuário local na hora
  depois de editar perfil/subir avatar (sem precisar de um round-trip extra a `/api/auth/me`).
- `lib/cep.ts` (novo) — `useCepAutofill`, hook extraído da lógica de ViaCEP que já existia (só)
  dentro de `create-order.tsx`; agora reaproveitado ali **e** no formulário de endereço novo.
- **Perfil do cliente** reescrito: avatar/nome/"Membro desde" reais (`useAuth().user`), 2 stats reais
  (pedidos concluídos, nota como cliente — a 3ª stat, "Favoritos", foi **removida** por não existir
  a feature, RF-D8 é P2 e não foi construído); menu com destinos reais ("Editar perfil", "Meus
  endereços", "Ajuda e suporte") — removidos "Formas de pagamento" e "Prestadores favoritos", que
  não levavam a lugar nenhum e não têm feature correspondente no escopo atual.
- **Nova tela** `client/edit-profile.tsx` — avatar (toque pra trocar via `expo-image-picker`, mesmo
  padrão do upload de documento da KYC), nome, telefone; e-mail mostrado como somente-leitura (fora
  de escopo alterar e-mail de login nesta rodada).
- **Novas telas** `client/addresses.tsx` (lista, com badge "Padrão", "Tornar padrão"/excluir por
  endereço) e `client/address-form.tsx` (criar/editar, CEP com autofill via `useCepAutofill`,
  "Definir como padrão" só na criação — trocar o padrão de um endereço existente é sempre pela
  lista).
- `create-order.tsx` — sem mudança de comportamento, só passou a usar o `useCepAutofill`
  compartilhado em vez da cópia própria da mesma lógica.

**Verificado E2E** via curl contra o Supabase real: `GET /api/auth/me` já retorna `createdAt`;
`PATCH` 401 sem token, 422 nome curto, 200 com nome/telefone novos (revertido depois pro valor
original do usuário de teste); `GET .../stats` retorna zerado pra conta sem pedido concluído/review;
livro de endereços — criar 2 endereços (1º não virou padrão automático porque essa conta **já tinha**
um `Address` de um pedido anterior, então `existingCount` não era zero — comportamento correto dado
que o "padrão automático" conta qualquer `Address` da conta, incluindo os avulsos de pedidos
antigos); marcar padrão (transação troca corretamente); editar; excluir o padrão promove o endereço
mais recente restante a padrão; excluir/editar endereço **de outro usuário** → `404` (não vaza que o
recurso existe); payload inválido → `422`; upload de avatar sem Storage configurado → erro claro
("Supabase Storage não configurado"), mesmo padrão do KYC, não um 500 genérico. Typecheck web+native
e os 51 testes automatizados seguem limpos.

**Pendências:** foto de perfil só funciona de ponta a ponta depois de ativar o Supabase Storage e
criar o bucket público `avatars` — mesma pendência de conta já registrada no incremento de KYC;
"padrão automático no primeiro endereço" pode surpreender quem já tem `Address` de pedidos antigos
(explicado acima, comportamento intencional, não bug); o formulário de criar pedido
(`create-order.tsx`) continua com endereço avulso — não foi integrado a escolher um endereço salvo
do livro (ficaria mais claro como um incremento à parte, envolve mudar o fluxo de pedido).

### ✅ Incremento — Central de ajuda/suporte + disputas (RF-H1/H2)

Primeiro bloco P1 pendente do roadmap que ainda estava 100% mock: `client/support.tsx` já existia no
protótipo original com FAQ estática, um card de "disputa" fake (`#D-0192`) e nenhum botão funcional
(nem os tópicos, nem "Falar com suporte" navegavam pra algum lugar). Migração: novo model
`SupportTicket` (`id`, `userId`, `orderId?`, `category` [`PAYMENT`/`CANCELLATION`/`SECURITY`/
`ACCOUNT`/`DISPUTE`/`OTHER`], `subject`, `message`, `status` [`OPEN`/`IN_PROGRESS`/`RESOLVED`],
`adminResponse?`, `resolvedAt?`) + `NotificationType.SUPPORT` novo no enum existente (RF-I1). Modelo
simples de pergunta/resposta única por chamado — sem fila, sem atribuição a um agente, sem
reabertura.

**Backend** (`apps/web/src/lib/support.ts` + rotas `apps/web/src/app/api/support/tickets/*`):
- `createSupportTicket` — abre um chamado; se vier `orderId` (disputa vinculada a um pedido),
  confirma que quem está abrindo é cliente ou prestador **daquele** pedido específico (404 genérico
  senão, mesmo padrão anti-enumeração dos outros recursos por usuário do app).
- `listMySupportTickets`/`getSupportTicket` — chamados do usuário atual; detalhe só pro autor.
- `POST/GET /api/support/tickets`, `GET /api/support/tickets/[id]`.
- Admin (`listAllSupportTickets`, `respondToSupportTicket`, `markSupportTicketInProgress`) — usados
  só pelas Server Actions do painel, sem rota HTTP própria pro app nativo.
- `respondToSupportTicket` grava a resposta, marca `RESOLVED` e notifica o autor via `notifyUser`
  (empilhado no incremento de notificações in-app, RF-I1) — `notifyUser` ganhou um terceiro ramo
  (`SUPPORT` sempre notifica, sem toggle de preferência próprio, diferente de `ORDER`/`MESSAGE`).

**Admin** (`apps/web/src/app/admin/(protected)/support/page.tsx` + `actions.ts`): nova aba "Chamados"
ao lado de "Prestadores" no layout do painel (antes só tinha o título fixo "Moderação de
prestadores", sem nenhuma navegação); lista pendentes (`OPEN`/`IN_PROGRESS`) primeiro, depois
respondidos; cada chamado pendente tem uma `Textarea` + botão "Responder e concluir" (finaliza numa
tacada só — não existe fluxo de ida-e-volta) e, se ainda `OPEN`, um botão extra "Marcar em análise".

**App:** `supportApi` + hooks (`useSupportTickets`/`useSupportTicket`/`useCreateSupportTicket`);
dois novos helpers em `lib/format.ts` (`supportCategoryLabel`/`supportStatusLabel`). Seguindo o
mesmo padrão de duplicação client/provider já usado em notificações e avaliação (sem componente
compartilhado): `client/support.tsx` e `provider/support.tsx` (nova) reescritas com FAQ real
(respostas específicas do que o app faz — pagamento/reembolso automático em cancelamento pago,
janela de cancelamento, verificação de KYC, exportação/exclusão de conta) em acordeão, seção "Meus
chamados" com status colorido, e CTA "Abrir um chamado"; `client/support-ticket-new.tsx` e
`provider/support-ticket-new.tsx` (formulário: categoria em chips, título, mensagem) e
`client/support-ticket/[id].tsx` e `provider/support-ticket/[id].tsx` (detalhe: mensagem enviada +
resposta do suporte ou estado "aguardando"). **Perfil do prestador** ganhou o primeiro item de menu
que já teve (só existiam os botões "Completar/editar cadastro" e "Trocar de perfil" antes) —
"Ajuda e suporte" levando pra tela nova. **Detalhe do pedido do cliente** ganhou o link "Reportar um
problema com esse pedido" (abre o formulário de chamado com `orderId` pré-preenchido e categoria
`DISPUTE` já selecionada, RF-H2).

`lib/notifications.ts` (`pathForNotification`) ganhou o ramo `type: "support"` — diferente de
`order`/`chat`, um chamado não tem "duas partes" (é sempre só do dono), então o servidor não tinha
de onde tirar o `role` como faz pra pedido/chat; `respondToSupportTicket` agora busca o `role` do
dono do chamado (`PROVIDER` → `"provider"`, senão `"client"`) só pra decidir em qual árvore de telas
(`client/` ou `provider/`) navegar ao tocar a notificação.

**Verificado E2E** via curl contra o Supabase real (usuário `teste.cliente@ajuda.app`): 401 sem
token; 422 assunto curto; 201 chamado geral; 201 chamado de disputa vinculado a um pedido real do
próprio usuário; 404 `orderId` inexistente; 404 ao tentar abrir chamado com `orderId` de pedido de
**outro** usuário (registrado na hora pra esse teste); 404 ao buscar chamado de outro usuário (não
vaza existência); `GET` lista reflete os chamados criados. Painel admin verificado via Playwright
(browser real, Chromium, mesmo método do incremento do painel de KYC): login → aba "Chamados" →
ambos os chamados de teste visíveis → resposta escrita e enviada → status vira "Respondido" e o
texto da resposta aparece persistido após reload — sem erros de console. Confirmado de volta pela
API do app que o chamado ficou `RESOLVED` com `adminResponse`/`resolvedAt` preenchidos e que a
notificação `SUPPORT` foi criada com `data: { type: "support", ticketId, role: "client" }` (mapeia
certo pro `pathForNotification`). `pnpm check-types` (precisou de `npx next typegen` uma vez pras
rotas novas do Next, mesmo passo dos incrementos anteriores) e `pnpm test` (54 testes, 3 casos novos
cobrindo o ramo `support` de `pathForNotification`) limpos nos três pacotes.

**Pendências:** sem retenção de valor durante uma disputa (o mock antigo mostrava "valor retido até
resolução" — não implementado, exigiria mexer no fluxo de pagamento/wallet); sem categorização
automática nem SLA; um chamado só permite uma resposta do admin (não há histórico de idas e vindas);
push da resposta do suporte usa o mesmo best-effort de sempre (Expo Push API), então depende da
mesma pendência de `eas init`/rebuild físico já registrada no incremento de push.

---

## 7. Próximos blocos sugeridos (P0 pendentes)

1. **Deploy da Geo na Railway (handoff com você, ver seção 6)** — sem isso, o código de geocoding
   (RF-C6) e ETA/distância (RF-C5, RF-E3) já pronto continua caindo nos fallbacks/`null`. Não dá pra
   avançar isso sem sua conta Railway; também não deu pra sequer validar os Dockerfiles localmente
   porque a máquina não tem Docker instalado (o README de `apps/geo` documenta esse teste local
   opcional, com um PBF pequeno, se quiser rodar você mesmo).
2. **Rebuild nativo** — build+boot no simulador iOS **já validado nesta sessão** (ver log acima);
   falta rodar num **device físico** (câmera/GPS/push reais) e no **Android**, além de navegar
   manualmente pelas telas de mapa/tracking pra conferir o MapLibre, localização, push (agora com
   projeto EAS vinculado) e o `PaymentSheet` do Stripe na prática.

Com isso, o punchlist de código P0 do roadmap (seção 5) fica completo — o que resta são handoffs de
infraestrutura/conta que só você pode fazer (Railway, Supabase Storage, Stripe Pix, device
físico/Android) — **EAS já foi resolvido nesta sessão**.

Com suporte/disputa (RF-H1/H2) entregue, o bloco 3 do roadmap (Confiança e financeiro, P1) fica só
com observabilidade (RNF-7: logs estruturados/Sentry/analytics de funil) em aberto — candidato
natural pro próximo incremento de código, já que também não depende de handoff de infra além de uma
conta Sentry gratuita.

---

## 8. Referências no repositório
- Guia técnico do LLM on-device: [apps/native/docs/react-native-executorch-guide.md](../apps/native/docs/react-native-executorch-guide.md)
- Planejamento da busca por IA: [apps/native/docs/ai-search-planning.md](../apps/native/docs/ai-search-planning.md)
- Checklist de cobertura: confrontar cada campo mockado em `apps/native/lib/mock-data.ts` com o dado real correspondente.
