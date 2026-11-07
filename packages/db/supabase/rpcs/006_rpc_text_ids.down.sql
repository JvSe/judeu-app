-- Volta às assinaturas UUID originais (as do 001_core.sql, que têm o bug text = uuid).
drop function if exists public.soft_delete_account(text, text, text, boolean);
drop function if exists public.set_default_address(text, text);
drop function if exists public.replace_provider_categories_services(text, text[], jsonb);
drop function if exists public.credit_wallet_on_payment(text, int, text, text, text, text);
-- Em seguida, reaplicar as quatro funções de packages/db/supabase/rpcs/001_core.sql.
