-- One place where chains are built: the chains / client_chains tables, edited on Admin -> Chains (super admin).
-- The dashboard holds the chain name, the selling company and the member stores; the B2B portal and later builds read it from here.
-- One store belongs to one chain (client_chains primary key = company + client).
-- The Tsomet budget file is no longer where membership comes from: the rows it created become ordinary rows (source 'manual')
-- and refresh_tsomet_client_chains() stops touching membership (the budget numbers themselves still load as before).

update public.client_chains set source = 'manual' where source = 'tsomet_budget';

create or replace function public.refresh_tsomet_client_chains()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Membership is maintained on Admin -> Chains; nothing to rebuild.
  return (select count(*)::int from public.client_chains where chain_id = 'tsomet');
end;
$function$;
revoke all on function public.refresh_tsomet_client_chains() from public, anon, authenticated;
grant execute on function public.refresh_tsomet_client_chains() to service_role;

-- All chains with their store count per company.
create or replace function public.admin_list_chains()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_super_admin() then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', ch.id, 'name', ch.name,
             'companies', coalesce((select jsonb_object_agg(x.company, x.n) from (
                 select cc.company, count(*) as n from client_chains cc where cc.chain_id = ch.id group by cc.company) x), '{}'::jsonb))
           order by ch.name)
    from chains ch), '[]'::jsonb);
end;
$function$;
grant execute on function public.admin_list_chains() to authenticated;

-- Create or rename a chain. The id is a slug of the name on creation.
create or replace function public.admin_save_chain(p_id text, p_name text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare nm text; cid text;
begin
  if not is_super_admin() then return null; end if;
  nm := btrim(coalesce(p_name, ''));
  if nm = '' then return jsonb_build_object('error', 'The chain needs a name.'); end if;
  if exists (select 1 from chains where lower(name) = lower(nm) and id is distinct from p_id) then
    return jsonb_build_object('error', 'A chain with that name already exists.');
  end if;
  if p_id is null or btrim(p_id) = '' then
    cid := trim(both '-' from regexp_replace(lower(nm), '[^a-z0-9]+', '-', 'g'));
    if cid = '' then cid := 'chain-' || substr(md5(nm), 1, 6); end if;
    if exists (select 1 from chains where id = cid) then return jsonb_build_object('error', 'A chain with that id already exists.'); end if;
    insert into chains (id, name) values (cid, nm);
  else
    cid := p_id;
    update chains set name = nm, updated_at = now() where id = cid;
  end if;
  return jsonb_build_object('id', cid, 'name', nm);
end;
$function$;
grant execute on function public.admin_save_chain(text, text) to authenticated;

-- Delete a chain that has no stores left.
create or replace function public.admin_delete_chain(p_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_super_admin() then return null; end if;
  if exists (select 1 from client_chains where chain_id = p_id) then
    return jsonb_build_object('error', 'Remove the chain''s stores first.');
  end if;
  delete from chains where id = p_id;
  return jsonb_build_object('ok', true);
end;
$function$;
grant execute on function public.admin_delete_chain(text) to authenticated;

-- The stores of one chain in one company.
create or replace function public.admin_chain_stores(p_chain_id text, p_company text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
begin
  if not is_super_admin() then return null; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', cc.client_id, 'name', c.name, 'city', c.city, 'agent', c.erp_agent_id,
             'source', cc.source) order by c.name nulls last, cc.client_id)
    from client_chains cc
    left join clients c on c.company = cc.company and c.erp_client_id = cc.client_id
    where cc.chain_id = p_chain_id and cc.company = p_company), '[]'::jsonb);
end;
$function$;
grant execute on function public.admin_chain_stores(text, text) to authenticated;

-- Add stores (client numbers) to a chain. Unknown numbers are reported, stores already in ANOTHER chain are
-- reported and left where they are unless p_move is true.
create or replace function public.admin_add_chain_stores(p_chain_id text, p_company text, p_ids text[], p_move boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare ids text[]; added int := 0; unknown text[]; taken jsonb;
begin
  if not is_super_admin() then return null; end if;
  if not exists (select 1 from chains where id = p_chain_id) then return jsonb_build_object('error', 'Unknown chain.'); end if;
  select coalesce(array_agg(distinct btrim(x)) filter (where btrim(x) <> ''), '{}') into ids from unnest(coalesce(p_ids, '{}')) x;
  select coalesce(array_agg(i), '{}') into unknown from unnest(ids) i
    where not exists (select 1 from clients c where c.company = p_company and c.erp_client_id = i);
  select coalesce(jsonb_agg(jsonb_build_object('id', cc.client_id, 'chain', ch.name)), '[]'::jsonb) into taken
    from client_chains cc join chains ch on ch.id = cc.chain_id
    where cc.company = p_company and cc.client_id = any(ids) and cc.chain_id <> p_chain_id;
  with ins as (
    insert into client_chains (company, client_id, chain_id, source)
    select p_company, i, p_chain_id, 'manual' from unnest(ids) i
    where i <> all(unknown)
    on conflict (company, client_id) do update
      set chain_id = excluded.chain_id, source = excluded.source, updated_at = now()
      where p_move and client_chains.chain_id <> excluded.chain_id
    returning 1)
  select count(*) into added from ins;
  return jsonb_build_object('added', added, 'unknown', to_jsonb(unknown), 'inOtherChain', case when p_move then '[]'::jsonb else taken end);
end;
$function$;
grant execute on function public.admin_add_chain_stores(text, text, text[], boolean) to authenticated;

create or replace function public.admin_remove_chain_store(p_company text, p_client_id text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not is_super_admin() then return null; end if;
  delete from client_chains where company = p_company and client_id = p_client_id;
  return jsonb_build_object('ok', true);
end;
$function$;
grant execute on function public.admin_remove_chain_store(text, text) to authenticated;

-- Find stores to add: by name or client number, with the chain they are already in.
create or replace function public.admin_search_stores(p_company text, p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '20s'
as $function$
declare q text;
begin
  if not is_super_admin() then return null; end if;
  q := btrim(coalesce(p_query, ''));
  if length(q) < 2 then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(r) from (
      select jsonb_build_object('id', c.erp_client_id, 'name', c.name, 'city', c.city, 'chain', ch.name) as r
      from clients c
      left join client_chains cc on cc.company = c.company and cc.client_id = c.erp_client_id
      left join chains ch on ch.id = cc.chain_id
      where c.company = p_company and c.erp_client_id is not null
        and (c.name ilike '%' || q || '%' or c.erp_client_id ilike q || '%')
      order by c.name
      limit 40) s), '[]'::jsonb);
end;
$function$;
grant execute on function public.admin_search_stores(text, text) to authenticated;
