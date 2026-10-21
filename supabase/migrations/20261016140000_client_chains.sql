-- Chain catalog and which client belongs to which chain, per selling company.
-- Tsomet membership is rebuilt from tsomet_store_budget. Other chains are added when their
-- source files exist. Intergroup sales stay in intergroup_clients (selling company + client number);
-- that list is filled by the owner, not guessed here.

create table if not exists public.chains (
  id          text primary key,
  name        text not null,
  updated_at  timestamptz not null default now()
);

insert into public.chains (id, name)
values ('tsomet', 'Tsomet')
on conflict (id) do update
  set name = excluded.name,
      updated_at = now();

alter table public.chains enable row level security;

drop policy if exists chains_read on public.chains;
create policy chains_read on public.chains
  for select to authenticated
  using (true);

create table if not exists public.client_chains (
  company     text not null,
  client_id   text not null,
  chain_id    text not null references public.chains (id),
  source      text not null,
  updated_at  timestamptz not null default now(),
  primary key (company, client_id)
);

create index if not exists client_chains_chain
  on public.client_chains (chain_id, company);

alter table public.client_chains enable row level security;

drop policy if exists client_chains_read on public.client_chains;
create policy client_chains_read on public.client_chains
  for select to authenticated
  using (public.is_admin_or_above() or company in (
    select unnest(allowed_companies) from public.user_profiles where id = auth.uid()));

-- Replace Tsomet links that came from the budget file. A client already assigned by hand
-- (any other source) is left as it is.
create or replace function public.refresh_tsomet_client_chains()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  n integer;
begin
  insert into public.chains (id, name)
  values ('tsomet', 'Tsomet')
  on conflict (id) do update
    set name = excluded.name,
        updated_at = now();

  delete from public.client_chains cc
  where cc.chain_id = 'tsomet'
    and cc.source = 'tsomet_budget'
    and not exists (
      select 1
      from public.tsomet_store_budget t
      join public.clients c
        on c.company = cc.company
       and c.erp_client_id = t.erp_number
      where t.erp_number is not null
        and btrim(t.erp_number) <> ''
        and c.erp_client_id = cc.client_id
    );

  insert into public.client_chains (company, client_id, chain_id, source)
  select c.company, c.erp_client_id, 'tsomet', 'tsomet_budget'
  from public.clients c
  join public.tsomet_store_budget t
    on t.erp_number = c.erp_client_id
  where t.erp_number is not null
    and btrim(t.erp_number) <> ''
    and c.erp_client_id is not null
    and btrim(c.erp_client_id) <> ''
  on conflict (company, client_id) do update
    set chain_id = excluded.chain_id,
        source = excluded.source,
        updated_at = now()
    where public.client_chains.source = 'tsomet_budget';

  select count(*) into n
  from public.client_chains
  where chain_id = 'tsomet'
    and source = 'tsomet_budget';
  return n;
end;
$function$;

revoke all on function public.refresh_tsomet_client_chains() from public, anon, authenticated;
grant execute on function public.refresh_tsomet_client_chains() to service_role;
