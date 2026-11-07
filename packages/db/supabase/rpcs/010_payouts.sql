-- Fase 3: saque de quem atende. Com PAYOUT_PROVIDER=simulated (padrão), o saque
-- é registrado e debitado da carteira, mas nenhum dinheiro é transferido.
CREATE TABLE IF NOT EXISTS payoutaccount (
  "id"         TEXT PRIMARY KEY,
  "userId"     TEXT NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
  "pixKeyType" TEXT NOT NULL CHECK ("pixKeyType" IN ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM')),
  "pixKey"     TEXT NOT NULL,
  "holderName" TEXT NOT NULL,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payout (
  "id"                 TEXT PRIMARY KEY,
  "userId"             TEXT NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "walletId"           TEXT NOT NULL REFERENCES wallet("id") ON DELETE CASCADE,
  "amountCents"        INT NOT NULL CHECK ("amountCents" > 0),
  "feeCents"           INT NOT NULL DEFAULT 0,
  "netCents"           INT NOT NULL,
  "status"             TEXT NOT NULL CHECK ("status" IN ('SIMULATED', 'PROCESSING', 'PAID', 'FAILED')),
  "provider"           TEXT NOT NULL,
  "providerRef"        TEXT,
  "pixKeyMasked"       TEXT NOT NULL,
  "balanceBeforeCents" INT NOT NULL,
  "balanceAfterCents"  INT NOT NULL,
  "createdAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "completedAt"        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS payout_userid_createdat_idx ON payout ("userId", "createdAt" DESC);

-- Debita a carteira e registra o saque numa transação só, com a carteira
-- travada (dois toques em "Sacar" não sacam duas vezes). p_held_cents é o valor
-- retido por disputa, calculado pela API.
create or replace function public.request_payout(
  p_payout_id text,
  p_user_id text,
  p_amount_cents int,
  p_fee_cents int,
  p_held_cents int,
  p_min_cents int,
  p_status text,
  p_provider text,
  p_provider_ref text,
  p_pix_key_masked text,
  p_description text
) returns payout
language plpgsql
security definer
as $$
declare
  w wallet;
  result payout;
  available int;
begin
  select * into w from wallet where "userId" = p_user_id for update;
  if w.id is null then
    raise exception 'PAYOUT_NO_BALANCE';
  end if;
  available := w."balanceCents" - greatest(p_held_cents, 0);
  if p_amount_cents < p_min_cents then
    raise exception 'PAYOUT_BELOW_MIN';
  end if;
  if p_amount_cents > available then
    raise exception 'PAYOUT_INSUFFICIENT';
  end if;

  update wallet
  set "balanceCents" = "balanceCents" - p_amount_cents, "updatedAt" = now()
  where id = w.id;

  insert into wallettransaction (id, "walletId", type, "amountCents", description, "orderId", "createdAt")
  values (gen_random_uuid()::text, w.id, 'DEBIT', p_amount_cents, p_description, null, now());

  insert into payout (
    id, "userId", "walletId", "amountCents", "feeCents", "netCents", status, provider,
    "providerRef", "pixKeyMasked", "balanceBeforeCents", "balanceAfterCents", "createdAt", "completedAt"
  ) values (
    p_payout_id, p_user_id, w.id, p_amount_cents, p_fee_cents, p_amount_cents - p_fee_cents, p_status,
    p_provider, p_provider_ref, p_pix_key_masked, w."balanceCents", w."balanceCents" - p_amount_cents, now(),
    case when p_status in ('SIMULATED', 'PAID') then now() else null end
  )
  returning * into result;

  return result;
end;
$$;
