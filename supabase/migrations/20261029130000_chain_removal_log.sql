-- Audit log for Admin -> Chains "remove all stores of a chain from one company".
-- Written only by remove_chain_stores() (SECURITY DEFINER), in the same transaction as the delete.
-- Readable by super admins only; no insert/update/delete policy for authenticated; no access for anon.
create table if not exists public.chain_removal_log (
  id uuid primary key default gen_random_uuid(),
  chain_id text not null,
  chain_name text,
  company text not null,
  removed_count integer not null,
  removed_by uuid default auth.uid(),
  removed_by_email text,
  removed_at timestamptz not null default now()
);
create index if not exists chain_removal_log_removed_at_idx on public.chain_removal_log (removed_at desc);
alter table public.chain_removal_log enable row level security;
drop policy if exists chain_removal_log_select_super_admin on public.chain_removal_log;
create policy chain_removal_log_select_super_admin on public.chain_removal_log
  for select to authenticated using (is_super_admin());
revoke all on public.chain_removal_log from public, anon, authenticated;
grant select on public.chain_removal_log to authenticated;

-- Rows are logged only when something was actually removed (0 removed = no log row).
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
  if n > 0 then
    insert into chain_removal_log (chain_id, chain_name, company, removed_count, removed_by, removed_by_email)
    values (p_chain_id, (select name from chains where id = p_chain_id), p_company, n, auth.uid(),
            (select email from user_profiles where id = auth.uid()));
  end if;
  return n;
end;
$function$;
revoke all on function public.remove_chain_stores(text, text) from public, anon;
grant execute on function public.remove_chain_stores(text, text) to authenticated;
