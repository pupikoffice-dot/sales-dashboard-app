-- Admin -> Chains: remove ALL stores of one chain from ONE company in a single action.
-- Only client_chains rows for (chain_id, company) are deleted; the chains row (shared across companies) and
-- the same chain's rows in other companies are never touched. Super admin only, enforced here.
-- Returns the number of rows deleted, or null for a non super admin (same convention as the other admin_* chain RPCs).
create or replace function public.remove_chain_stores(p_chain_id text, p_company text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare n integer;
begin
  if not is_super_admin() then return null; end if;
  if p_chain_id is null or btrim(p_chain_id) = '' or p_company is null or btrim(p_company) = '' then
    raise exception 'chain and company are required';
  end if;
  delete from client_chains where chain_id = p_chain_id and company = p_company;
  get diagnostics n = row_count;
  return n;
end;
$function$;
revoke all on function public.remove_chain_stores(text, text) from public, anon;
grant execute on function public.remove_chain_stores(text, text) to authenticated;
