-- Fase 1: comissão por pedido (snapshot). Pedidos existentes ficam com o padrão
-- 0.08/CLIENT — exatamente a regra com que foram criados. Os novos recebem a regra
-- da configuração (apps/web/src/lib/config.ts → 20% descontados de quem atende).
ALTER TABLE "order"
  ADD COLUMN IF NOT EXISTS "feeRate"  DOUBLE PRECISION NOT NULL DEFAULT 0.08,
  ADD COLUMN IF NOT EXISTS "feePayer" TEXT NOT NULL DEFAULT 'CLIENT';

ALTER TABLE "order" DROP CONSTRAINT IF EXISTS order_feepayer_check;
ALTER TABLE "order" ADD CONSTRAINT order_feepayer_check CHECK ("feePayer" IN ('CLIENT', 'PROVIDER'));

-- Taxa por categoria (opcional; null = usa a geral).
ALTER TABLE category ADD COLUMN IF NOT EXISTS "feeRate" DOUBLE PRECISION;

-- create_order_with_event passa a gravar o snapshot. Sem as chaves no JSON
-- (código antigo), cai no padrão da coluna — compatível com a main.
create or replace function public.create_order_with_event(
  p_order jsonb,
  p_event_note text default null
) returns "order"
language plpgsql
security definer
as $$
declare
  result "order";
  oid uuid := coalesce((p_order->>'id')::uuid, gen_random_uuid());
begin
  insert into "order" (
    id, "clientId", "providerId", "serviceId", "categoryId", "addressId", "pickupAddressId",
    "isOpenRequest", "detailsReady", description, status, "scheduledAt",
    "priceCents", "platformFeeCents", "totalCents", "feeRate", "feePayer", "createdAt", "updatedAt"
  )
  values (
    oid,
    (p_order->>'clientId')::uuid,
    nullif(p_order->>'providerId', '')::uuid,
    nullif(p_order->>'serviceId', '')::uuid,
    nullif(p_order->>'categoryId', '')::uuid,
    (p_order->>'addressId')::uuid,
    nullif(p_order->>'pickupAddressId', '')::uuid,
    coalesce((p_order->>'isOpenRequest')::boolean, false),
    coalesce((p_order->>'detailsReady')::boolean, false),
    p_order->>'description',
    coalesce(p_order->>'status', 'CREATED')::orderstatus,
    nullif(p_order->>'scheduledAt', '')::timestamptz,
    coalesce((p_order->>'priceCents')::int, 0),
    coalesce((p_order->>'platformFeeCents')::int, 0),
    coalesce((p_order->>'totalCents')::int, 0),
    coalesce((p_order->>'feeRate')::float8, 0.08),
    coalesce(nullif(p_order->>'feePayer', ''), 'CLIENT'),
    now(),
    now()
  )
  returning * into result;

  insert into orderevent (id, "orderId", status, note, "createdAt")
  values (gen_random_uuid(), result.id, result.status, p_event_note, now());

  return result;
end;
$$;
