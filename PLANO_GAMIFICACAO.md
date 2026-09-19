# Plano de Gamificação — Judeu

## Contexto

O Judeu é um marketplace de serviços locais (estilo GetNinjas) com dois papéis, CLIENT e PROVIDER. O produto já resolve o essencial (pedidos, chat, tracking, pagamentos, avaliação, suporte), mas hoje não há nenhum mecanismo de retenção/engajamento além da UX básica — nenhum sinal de progresso, confiabilidade ou reconhecimento é exposto ao usuário além da nota média crua (`ratingAvg`). O pedido é desenhar gamificação para todo o app, pensando como engenheiro RN/Expo + UI/UX.

Como este é um marketplace de trabalho real (eletricistas, diaristas, etc.), com público que inclui prestadores autônomos de meia-idade, a gamificação precisa ser **sóbria**: reforçar sinais de confiança que já existem (nota, conclusão, recorrência), nunca introduzir moeda fictícia, loot box, ranking público entre pessoas, ou métricas que recompensem velocidade de aceite em vez de qualidade. Nomenclatura em português claro ("selo", "nível de confiabilidade", "conquista"), sem gíria gamer em inglês, sem confete/som de caça-níquel.

Explorei a arquitetura atual e confirmei que é terreno greenfield: não existe nenhum modelo, rota ou componente de badge/pontos/nível/streak hoje. Padrões já estabelecidos que este plano reaproveita:
- `apps/native/lib/api.ts` — objetos namespaced por domínio sobre um `apiFetch<T>` com Bearer token.
- `apps/native/lib/hooks.ts` — par `useQuery`/`useMutation` por domínio, invalidando query keys no sucesso.
- `apps/web/src/app/api/<resource>/route.ts` → `requireAuth` → Zod → lógica em `apps/web/src/lib/<resource>.ts` (Prisma só ali) → `json()`/`error()`.
- `apps/web/src/lib/notifications.ts` `notifyUser(userId, type, payload)` — já persiste notificação + dispara push, respeitando toggle por tipo (`notifyOrders`/`notifyMessages`).
- Design system nativo dark/glass: `apps/native/components/ui/stat-card.tsx`, `glass-surface.tsx`, tema `#FF6600` laranja + `rgba(28,28,58,0.8-0.9)`, `apps/native/constants/fonts.ts`. Não existe `Badge`/`ProgressRing` reutilizável ainda.

## Mecânicas por persona

**Provider (núcleo de valor — confiabilidade/qualidade):**
- **Nível de Confiabilidade** (`NONE → BRONZE → SILVER → GOLD → PLATINUM`), calculado a partir de `ratingAvg`/`ratingCount` (já existentes em `ProviderProfile`) + taxa de conclusão (`COMPLETED` vs. cancelado após `ACCEPTED`) + tempo de atividade. **Nunca** usa tempo de aceite do pedido (ver Riscos).
- Selos de marco: "Primeiros passos" (1º pedido concluído), "Bem avaliado" (`ratingAvg ≥ 4.5` e `ratingCount ≥ 10`), "Confiável" (taxa de conclusão ≥ 90% com ≥ 5 pedidos), "Veterano" (≥ 6 meses `APPROVED`), "Verificado" (espelha KYC já existente: `status === APPROVED` + `documentUrl`), "Especialista em `<categoria>`" (categoria mais frequente nos últimos pedidos).
- Selos aparecem no **perfil público visto pelo cliente**, ao lado de `ratingAvg` — é o ganho de negócio real (conversão na escolha do prestador). Sem leaderboard entre prestadores.

**Client (retenção/engajamento):**
- **Nível de Cliente** (`NONE/BRONZE/SILVER/GOLD`) por nº de pedidos `COMPLETED`.
- Selo "Avaliador" por nº de reviews escritos — incentiva feedback que alimenta a reputação dos prestadores.
- Marco com perk real (não cosmético): ao atingir 5º/10º pedido concluído, gerar `couponCode` (campo já existente em `Order`) automaticamente.

## Modelo de dados (Prisma)

Reaproveita `ProviderProfile.ratingAvg/ratingCount` sem duplicar. Novo bloco em `packages/db/prisma/schema/schema.prisma`:

```prisma
enum GamificationEventType {
  ORDER_COMPLETED
  ORDER_CANCELLED_BY_CLIENT
  ORDER_CANCELLED_BY_PROVIDER
  REVIEW_RECEIVED
  REVIEW_WRITTEN
}

enum BadgeAudience   { CLIENT PROVIDER BOTH }
enum BadgeTier       { BRONZE SILVER GOLD PLATINUM }
enum ReliabilityTier { NONE BRONZE SILVER GOLD PLATINUM }
enum ClientTier      { NONE BRONZE SILVER GOLD }

// Log de auditoria/idempotência — todo evento de gamificação passa por aqui.
model GamificationEvent {
  id        String                @id @default(uuid())
  userId    String
  type      GamificationEventType
  orderId   String?
  payload   Json?
  createdAt DateTime              @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, type, orderId]) // evita duplo-disparo do mesmo pedido
  @@index([userId, createdAt])
}

// Catálogo de selos — dado semi-estático, seedado.
model Badge {
  id          String        @id @default(uuid())
  slug        String        @unique
  audience    BadgeAudience
  tier        BadgeTier?
  title       String
  description String
  icon        String // nome do Ionicon
  isActive    Boolean       @default(true)
  createdAt   DateTime      @default(now())

  earnedBy UserBadge[]
}

model UserBadge {
  id       String   @id @default(uuid())
  userId   String
  badgeId  String
  orderId  String?
  earnedAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  badge Badge @relation(fields: [badgeId], references: [id], onDelete: Cascade)

  @@unique([userId, badgeId])
  @@index([userId])
}

// Agregados incrementais — mesmo padrão de denormalização de ratingAvg/ratingCount.
model ProviderStats {
  id                        String          @id @default(uuid())
  providerProfileId         String          @unique
  completedOrdersCount      Int             @default(0)
  cancelledAfterAcceptCount Int             @default(0)
  currentTier               ReliabilityTier @default(NONE)
  tierUpdatedAt             DateTime?
  updatedAt                 DateTime        @updatedAt

  providerProfile ProviderProfile @relation(fields: [providerProfileId], references: [id], onDelete: Cascade)
}

model ClientStats {
  id                   String     @id @default(uuid())
  userId               String     @unique
  completedOrdersCount Int        @default(0)
  reviewsWrittenCount  Int        @default(0)
  currentTier          ClientTier @default(NONE)
  tierUpdatedAt        DateTime?
  updatedAt            DateTime   @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

Ajustes em modelos existentes:
- `NotificationType`: adicionar `ACHIEVEMENT`.
- `User`: `notifyAchievements Boolean @default(true)` (mesmo padrão de `notifyOrders`/`notifyMessages`); relações `gamificationEvents`, `badges UserBadge[]`, `clientStats ClientStats?`.
- `ProviderProfile`: relação `stats ProviderStats?`.
- `apps/web/src/lib/notifications.ts` `notifyUser()`: incluir `ACHIEVEMENT` no branch do toggle (`type === "ACHIEVEMENT" ? user.notifyAchievements : ...`), e adicionar `notifyAchievements: true` ao `select` da query.

Migração via `pnpm --filter @judeu/db db:migrate` (ou `db:push` em dev); seed dos `Badge` reaproveitando o padrão de `apps/web/src/app/api/dev/seed/route.ts`.

## Arquitetura de regras/eventos

Ponto central único, **`apps/web/src/lib/gamification.ts`**, seguindo o padrão fire-and-forget de `notifications.ts` (nunca derruba o fluxo principal):

```ts
export async function recordEvent(
  type: GamificationEventType,
  payload: { userId: string; orderId?: string; rating?: number },
): Promise<void> {
  try {
    await prisma.gamificationEvent.create({ data: { ...payload, type } }); // @@unique cuida de idempotência
    await applyStatsUpdate(type, payload);        // incrementa ProviderStats/ClientStats
    await evaluateBadgesAndTier(payload.userId);   // registry de regras em código
  } catch (e) {
    if (isUniqueViolation(e)) return; // evento já processado
    // best-effort — nunca propaga
  }
}
```

`BADGE_RULES: Record<slug, (stats) => boolean>` fica em código (não motor dinâmico) — simples e auditável. Quando `evaluateBadgesAndTier` detecta mudança de tier, chama `notifyUser(userId, "ACHIEVEMENT", {...})`.

Pontos de disparo (uma linha em cada, nenhum outro `lib/*.ts` precisa saber que gamificação existe):
- `apps/web/src/lib/orders.ts`, dentro de `transitionOrder()` (linha ~334), após o `prisma.order.update`:
  - `rule.to === "COMPLETED"` → `recordEvent("ORDER_COMPLETED", { userId: order.clientId, orderId: id })` e `recordEvent("ORDER_COMPLETED", { userId: order.provider.userId, orderId: id })`.
  - `rule.to === "CANCELLED"` e status anterior já era `ACCEPTED`/`EN_ROUTE`/`IN_PROGRESS` → `recordEvent(rule.by === "provider" ? "ORDER_CANCELLED_BY_PROVIDER" : "ORDER_CANCELLED_BY_CLIENT", {...})`.
- `apps/web/src/lib/reviews.ts`, dentro de `createReview()` (linha ~39), logo após a atualização de reputação:
  - `recordEvent("REVIEW_RECEIVED", { userId: targetId, orderId, rating: input.rating })`
  - `recordEvent("REVIEW_WRITTEN", { userId: authorId, orderId })`

## Endpoints e hooks

Web (somente leitura — nada concede selo diretamente, tudo nasce de `recordEvent`):
- `apps/web/src/app/api/gamification/me/route.ts` → `GET`, delega `getMyGamificationSummary(userId, role)`.
- `apps/web/src/app/api/gamification/badges/route.ts` → `GET` catálogo, delega `listBadgeCatalog(audience)`.
- `apps/web/src/app/api/providers/[id]/badges/route.ts` → `GET` selos públicos do prestador (mesmo padrão de `apps/web/src/app/api/providers/[id]/reviews/route.ts`).

Nativo — novo bloco `gamificationApi` em `apps/native/lib/api.ts` (mesmo padrão de `reviewsApi`):
```ts
export const gamificationApi = {
  me: () => apiFetch<{ summary: GamificationSummary }>("/api/gamification/me").then(r => r.summary),
  catalog: () => apiFetch<{ badges: Badge[] }>("/api/gamification/badges").then(r => r.badges),
  providerBadges: (providerId: string) =>
    apiFetch<{ badges: EarnedBadge[] }>(`/api/providers/${providerId}/badges`).then(r => r.badges),
};
```

Hooks em `apps/native/lib/hooks.ts`:
```ts
export function useGamificationSummary() {
  return useQuery({ queryKey: ["gamification", "me"], queryFn: gamificationApi.me });
}
export function useBadgeCatalog() {
  return useQuery({ queryKey: ["gamification", "catalog"], queryFn: gamificationApi.catalog, staleTime: 60 * 60 * 1000 });
}
export function useProviderBadges(providerId: string) {
  return useQuery({
    queryKey: ["provider-badges", providerId],
    queryFn: () => gamificationApi.providerBadges(providerId),
    enabled: !!providerId,
  });
}
```
Adicionar `qc.invalidateQueries({ queryKey: ["gamification"] })` no `onSuccess` de `useTransitionOrder` e `useCreateReview` (já existentes), para o resumo atualizar sozinho após concluir pedido/avaliar.

## UI/UX

Componentes novos em `apps/native/components/ui/`:
- **`badge-pill.tsx`** — `<BadgePill icon="ribbon" label="Confiável" tone="bronze|silver|gold|platinum" />`, visual glass consistente com os pills já usados em `rating/[id].tsx` (`rgba(28,28,58,0.9)` + borda tonal), tons terrosos (bronze `#B08D57`, prata `#C7C9D9`, ouro `#E4B343`) — nada neon.
- **`progress-ring.tsx`** — anel de progresso via `react-native-svg` (já é dependência) para "faltam N para o próximo nível".
- **`tier-chip.tsx`** — chip compacto com o nível atual, tocável, abre a tela de conquistas.
- Reaproveitar `StatCard` existente para números simples ("12 concluídos") — sem componente novo ali.

Telas:
- `apps/native/app/provider/(tabs)/index.tsx` — card compacto abaixo do `headerRow` com `TierChip` + `ProgressRing`.
- `apps/native/app/provider/(tabs)/profile.tsx` e o perfil público do prestador (visto pelo cliente, onde `ratingAvg` já aparece) — seção "Selos e reputação" com grade de `BadgePill`; este último é o ponto de maior valor de conversão.
- `apps/native/app/client/(tabs)/profile.tsx` — seção "Seu progresso" (tier + contadores).
- Novas telas `apps/native/app/provider/badges.tsx` e `apps/native/app/client/badges.tsx` — grade do catálogo completo (conquistado = ícone colorido + data; bloqueado = contorno cinza + critério), mesmo padrão de lista das telas de notificações/suporte.
- `.../rating/[id].tsx` (cliente e prestador) — após submit bem-sucedido, se o resumo indicar novo selo/nível, card inline reaproveitando `styles.doneBadge` já existente ali — sem confete/som.

## Fases de entrega

1. **Fundação** — migration completa; `gamification.ts` só com `recordEvent` incrementando `ProviderStats`/`ClientStats` (sem badges/tiers ainda); hooks nos 2 pontos de `orders.ts`/`reviews.ts`; `GET /api/gamification/me` cru; `StatCard` no dashboard do prestador ("X serviços concluídos") — zero componente novo de UI.
2. **Selos do prestador** — seed de 5-6 badges; cálculo de `ReliabilityTier`; `BadgePill`/`TierChip`; UI no dashboard, perfil do prestador e perfil público; notificação `ACHIEVEMENT`.
3. **Progresso do cliente** — `ClientTier`, selo "Avaliador", tela "Minhas conquistas", cupom automático nos marcos.
4. **Refinamento** — `ProgressRing`, card inline pós-avaliação, badge "Especialista em categoria", painel admin agregado (sem leaderboard público), tier como desempate leve (não filtro forte) na listagem de prestadores — cuidando do cold-start de prestadores novos.
5. **Opcional, só com evidência de necessidade** — nudges de reengajamento ("faltam 2 para o próximo nível"), rate-limitados (ex. 1x/semana via `lastNudgeSentAt`); avaliar taxa de opt-out de `notifyAchievements` antes de expandir.

## Riscos e cuidados

- **LGPD**: os novos dados derivam de dados pessoais já tratados (pedidos/avaliações) — devem entrar no fluxo de anonimização de `User.deletedAt` (`apps/web/src/lib/account.ts`) ao excluir conta.
- **Nunca gamificar velocidade de aceite** — recompensaria aceitar pedido sem ler direito, contra a qualidade de serviço.
- **Sem leaderboard público** entre prestadores — evita competição tóxica sobre trabalhadores autônomos; tudo é progresso individual.
- **Cancelamento não vira selo negativo público** — usado só internamente para elegibilidade a selos positivos.
- **Cold start**: prestador novo mostra tier `NONE` como neutro ("em construção"), nunca como posição inferior explícita.
- **Estética anti-cassino**: sem barra de XP saturada, confete, som, moeda fictícia; paleta terrosa; sem `expo-haptics` hoje no projeto — avaliar antes de adicionar dependência só para isso.
- **Nomenclatura em português claro** — "nível de confiabilidade", "selo", "conquista"; nunca "XP"/"level up"/"streak" em inglês.
- **Idempotência**: `@@unique([userId, type, orderId])` evita contagem dupla em retries de `transitionOrder`/`createReview`.
- **Performance**: contadores incrementais, mesmo padrão de denormalização já usado em `ratingAvg`/`ratingCount` — nunca recomputar agregados pesados a cada leitura.

## Verificação

- `pnpm --filter @judeu/db db:migrate` roda sem erro e gera o client Prisma atualizado; seed de badges popula a tabela `Badge`.
- Testes de fluxo manual via app: completar um pedido de teste (fluxo cliente→prestador) e confirmar que `GamificationEvent` é criado 1x por lado (checar no Supabase/Prisma Studio), `ProviderStats.completedOrdersCount` incrementa, e repetir a mesma transição não duplica (idempotência do `@@unique`).
- Avaliar um pedido de teste e confirmar `REVIEW_RECEIVED`/`REVIEW_WRITTEN` disparam e, se cruzar o limiar de um badge (ex. 1º pedido concluído), `UserBadge` é criado e uma `Notification` do tipo `ACHIEVEMENT` aparece no centro de notificações do app.
- Abrir `GET /api/gamification/me` autenticado (client e provider) e conferir o formato do resumo retornado.
- No app, abrir dashboard do prestador e perfil público de um prestador com badges seedados/conquistados e confirmar que `TierChip`/`BadgePill` renderizam com o tema dark/laranja existente, em telas claro e escuro se aplicável.

### Arquivos críticos
- `packages/db/prisma/schema/schema.prisma`
- `apps/web/src/lib/gamification.ts` (novo)
- `apps/web/src/lib/orders.ts`
- `apps/web/src/lib/reviews.ts`
- `apps/web/src/lib/notifications.ts`
- `apps/native/lib/api.ts`
- `apps/native/lib/hooks.ts`
- `apps/native/components/ui/badge-pill.tsx`, `progress-ring.tsx`, `tier-chip.tsx` (novos)
- `apps/native/app/provider/(tabs)/index.tsx`
