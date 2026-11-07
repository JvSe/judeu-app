-- Fase 1 (QA P-01, C-04, C-22): os IDs do schema são TEXT, mas estas RPCs
-- recebiam UUID e comparavam `text = uuid` → "operator does not exist", HTTP 500
-- no cadastro de profissional, em "tornar endereço padrão" e na exclusão de conta.
-- Recria com parâmetros TEXT (o supabase-js já envia strings: nada muda no chamador).

drop function if exists public.soft_delete_account(uuid, text, text, boolean);
create or replace function public.soft_delete_account(
  p_user_id text,
  p_email text,
  p_password_hash text,
  p_has_provider boolean
) returns void
language plpgsql
security definer
as $$
begin
  update "user"
  set
    email = p_email,
    "fullName" = 'Usuário excluído',
    phone = null,
    "avatarUrl" = null,
    "passwordHash" = p_password_hash,
    "pushToken" = null,
    "deletedAt" = now(),
    "updatedAt" = now()
  where id = p_user_id;

  if p_has_provider then
    update providerprofile
    set
      status = 'BLOCKED',
      "isAvailable" = false,
      headline = null,
      bio = null,
      "updatedAt" = now()
    where "userId" = p_user_id;
  end if;
end;
$$;

drop function if exists public.set_default_address(uuid, uuid);
create or replace function public.set_default_address(
  p_user_id text,
  p_address_id text
) returns address
language plpgsql
security definer
as $$
declare
  result address;
begin
  update address set "isDefault" = false where "userId" = p_user_id and "isDefault" = true;
  update address set "isDefault" = true where id = p_address_id and "userId" = p_user_id
  returning * into result;
  if result.id is null then
    raise exception 'address not found';
  end if;
  return result;
end;
$$;

drop function if exists public.replace_provider_categories_services(uuid, uuid[], jsonb);
create or replace function public.replace_provider_categories_services(
  p_provider_id text,
  p_category_ids text[],
  p_services jsonb
) returns void
language plpgsql
security definer
as $$
declare
  svc jsonb;
begin
  delete from providercategory where "providerId" = p_provider_id;
  if array_length(p_category_ids, 1) is not null then
    insert into providercategory ("providerId", "categoryId")
    select p_provider_id, unnest(p_category_ids);
  end if;

  delete from service where "providerId" = p_provider_id;
  for svc in select * from jsonb_array_elements(p_services)
  loop
    insert into service (id, "providerId", "categoryId", name, "priceCents", "createdAt")
    values (
      coalesce(nullif(svc->>'id', ''), gen_random_uuid()::text),
      p_provider_id,
      svc->>'categoryId',
      svc->>'name',
      (svc->>'priceCents')::int,
      now()
    );
  end loop;
end;
$$;

drop function if exists public.credit_wallet_on_payment(uuid, int, uuid, text, uuid, text);
create or replace function public.credit_wallet_on_payment(
  p_provider_user_id text,
  p_amount_cents int,
  p_order_id text,
  p_description text,
  p_payment_id text,
  p_gateway_ref text default null
) returns void
language plpgsql
security definer
as $$
declare
  wid text;
begin
  insert into wallet (id, "userId", "balanceCents", "updatedAt")
  values (gen_random_uuid()::text, p_provider_user_id, 0, now())
  on conflict ("userId") do nothing;

  select id into wid from wallet where "userId" = p_provider_user_id;

  update wallet
  set "balanceCents" = "balanceCents" + p_amount_cents, "updatedAt" = now()
  where id = wid;

  insert into wallettransaction (id, "walletId", type, "amountCents", description, "orderId", "createdAt")
  values (gen_random_uuid()::text, wid, 'CREDIT', p_amount_cents, p_description, p_order_id, now());

  update payment
  set status = 'PAID', "gatewayRef" = coalesce(p_gateway_ref, "gatewayRef"), "updatedAt" = now()
  where id = p_payment_id;
end;
$$;
