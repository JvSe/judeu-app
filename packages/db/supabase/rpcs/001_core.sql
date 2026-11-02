-- RPCs atômicas para o runtime supabase-js (substituem $transaction do Prisma).
-- Aplicar no SQL Editor do Supabase (ou supabase db query). Sem deploy Worker.

create or replace function public.soft_delete_account(
  p_user_id uuid,
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

create or replace function public.set_default_address(
  p_user_id uuid,
  p_address_id uuid
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

create or replace function public.replace_provider_categories_services(
  p_provider_id uuid,
  p_category_ids uuid[],
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
      coalesce((svc->>'id')::uuid, gen_random_uuid()),
      p_provider_id,
      (svc->>'categoryId')::uuid,
      svc->>'name',
      (svc->>'priceCents')::int,
      now()
    );
  end loop;
end;
$$;

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
    "priceCents", "platformFeeCents", "totalCents", "createdAt", "updatedAt"
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
    now(),
    now()
  )
  returning * into result;

  insert into orderevent (id, "orderId", status, note, "createdAt")
  values (gen_random_uuid(), result.id, result.status, p_event_note, now());

  return result;
end;
$$;

-- IDs no Prisma/Supabase são text (não uuid nativo). Assinatura e casts em text.
drop function if exists public.transition_order(uuid, orderstatus, jsonb, text);
create or replace function public.transition_order(
  p_order_id text,
  p_status orderstatus,
  p_patch jsonb,
  p_event_note text default null
) returns "order"
language plpgsql
security definer
as $$
declare
  result "order";
begin
  update "order" set
    status = p_status,
    "priceCents" = coalesce((p_patch->>'priceCents')::int, "priceCents"),
    "platformFeeCents" = coalesce((p_patch->>'platformFeeCents')::int, "platformFeeCents"),
    "totalCents" = coalesce((p_patch->>'totalCents')::int, "totalCents"),
    "cancelReason" = coalesce(p_patch->>'cancelReason', "cancelReason"),
    "acceptedAt" = coalesce(nullif(p_patch->>'acceptedAt', '')::timestamptz, "acceptedAt"),
    "completedAt" = coalesce(nullif(p_patch->>'completedAt', '')::timestamptz, "completedAt"),
    "cancelledAt" = coalesce(nullif(p_patch->>'cancelledAt', '')::timestamptz, "cancelledAt"),
    "providerId" = coalesce(nullif(p_patch->>'providerId', ''), "providerId"),
    "providerLat" = coalesce((p_patch->>'providerLat')::float8, "providerLat"),
    "providerLng" = coalesce((p_patch->>'providerLng')::float8, "providerLng"),
    "providerLocationAt" = coalesce(nullif(p_patch->>'providerLocationAt', '')::timestamptz, "providerLocationAt"),
    "detailsReady" = coalesce((p_patch->>'detailsReady')::boolean, "detailsReady"),
    "pickupAddressId" = case
      when p_patch ? 'pickupAddressId' then nullif(p_patch->>'pickupAddressId', '')
      else "pickupAddressId"
    end,
    "addressId" = coalesce(nullif(p_patch->>'addressId', ''), "addressId"),
    "updatedAt" = now()
  where id = p_order_id
  returning * into result;

  if result.id is null then
    raise exception 'order not found';
  end if;

  insert into orderevent (id, "orderId", status, note, "createdAt")
  values (gen_random_uuid()::text, result.id, p_status, p_event_note, now());

  return result;
end;
$$;

create or replace function public.credit_wallet_on_payment(
  p_provider_user_id uuid,
  p_amount_cents int,
  p_order_id uuid,
  p_description text,
  p_payment_id uuid,
  p_gateway_ref text default null
) returns void
language plpgsql
security definer
as $$
declare
  wid uuid;
begin
  insert into wallet (id, "userId", "balanceCents", "updatedAt")
  values (gen_random_uuid(), p_provider_user_id, 0, now())
  on conflict ("userId") do nothing;

  select id into wid from wallet where "userId" = p_provider_user_id;

  update wallet
  set "balanceCents" = "balanceCents" + p_amount_cents, "updatedAt" = now()
  where id = wid;

  insert into wallettransaction (id, "walletId", type, "amountCents", description, "orderId", "createdAt")
  values (gen_random_uuid(), wid, 'CREDIT', p_amount_cents, p_description, p_order_id, now());

  update payment
  set status = 'PAID', "gatewayRef" = coalesce(p_gateway_ref, "gatewayRef"), "updatedAt" = now()
  where id = p_payment_id;
end;
$$;

create or replace function public.create_job_with_shifts(
  p_job jsonb,
  p_shifts jsonb
) returns jobposting
language plpgsql
security definer
as $$
declare
  result jobposting;
  jid uuid := coalesce((p_job->>'id')::uuid, gen_random_uuid());
  sh jsonb;
begin
  insert into jobposting (
    id, "providerId", "categoryId", title, description, "contractType",
    "salaryCents", status, "createdAt", "updatedAt"
  )
  values (
    jid,
    (p_job->>'providerId')::uuid,
    (p_job->>'categoryId')::uuid,
    p_job->>'title',
    p_job->>'description',
    (p_job->>'contractType')::jobcontracttype,
    nullif(p_job->>'salaryCents', '')::int,
    coalesce(p_job->>'status', 'OPEN')::jobstatus,
    now(),
    now()
  )
  returning * into result;

  for sh in select * from jsonb_array_elements(p_shifts)
  loop
    insert into jobshift (id, "jobPostingId", weekday, "startTime", "endTime")
    values (
      gen_random_uuid(),
      result.id,
      (sh->>'weekday')::weekday,
      sh->>'startTime',
      sh->>'endTime'
    );
  end loop;

  return result;
end;
$$;
