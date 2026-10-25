-- Client card for a whole chain. A chain is addressed as the client id 'chain:<chain id>' (e.g. 'chain:tsomet'); its members come from
-- client_chains. The client card, the credit check and the this-year-vs-last-year functions then sum over all the member stores.
-- An agent-limited user gets only the member stores his agents own (and nothing if he owns none).
-- The three existing functions are patched in place (text replace on pg_get_functiondef) so nothing else in them can drift;
-- the block fails loudly if their text changed and is safe to run twice.

do $$
declare
  f record;
  def text;
  newdef text;
  owner_block text := E'  if p_client_id like ''chain:%'' then\n'
    || E'    select coalesce(array_agg(cc.client_id), ''{}'') into members\n'
    || E'    from client_chains cc\n'
    || E'    where cc.company = p_company and cc.chain_id = substr(p_client_id, 7)\n'
    || E'      and (not lim or cc.client_id in (select o.client_id from client_owner_v(p_company) o where o.agent_id = any(acc.agents)));\n'
    || E'    if coalesce(array_length(members, 1), 0) = 0 then return null; end if;\n'
    || E'    owner := null;\n'
    || E'  else\n'
    || E'    owner := client_owner_of(p_company, p_client_id);\n'
    || E'    if lim and (owner is null or not (owner = any(acc.agents))) then return null; end if;\n'
    || E'    members := array[p_client_id];\n'
    || E'  end if;';
  old_owner text := E'  owner := client_owner_of(p_company, p_client_id);\n  if lim and (owner is null or not (owner = any(acc.agents))) then return null; end if;';
begin
  for f in
    select p.oid, p.proname from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('get_client_card', 'get_client_credit_check', 'get_client_vs_last_year')
  loop
    def := pg_get_functiondef(f.oid);
    continue when def like '%members text[]%';
    newdef := replace(def, 'declare acc dashboard_user_access;', 'declare members text[]; acc dashboard_user_access;');
    if newdef = def then raise exception 'chain_cards: declare not found in %', f.proname; end if;
    def := newdef;
    newdef := replace(def, old_owner, owner_block);
    if newdef = def then raise exception 'chain_cards: owner check not found in %', f.proname; end if;
    def := newdef;
    if f.proname = 'get_client_credit_check' then
      newdef := replace(def, 's.client_id = p_client_id', 's.client_id = any(members)');
      if newdef = def then raise exception 'chain_cards: client filter not found in %', f.proname; end if;
      def := newdef;
      newdef := replace(def, 'r.client_id = p_client_id', 'r.client_id = any(members)');
      if newdef = def then raise exception 'chain_cards: reason filter not found in %', f.proname; end if;
    else
      newdef := replace(def, 'f.client_id = p_client_id', 'f.client_id = any(members)');
      if newdef = def then raise exception 'chain_cards: client filter not found in %', f.proname; end if;
    end if;
    def := newdef;
    if f.proname = 'get_client_card' then
      -- a chain shows its own name and store count instead of a single client's record
      newdef := replace(def, E'  ) into res;\n  return res;\nend;',
        E'  ) into res;\n'
        || E'  if p_client_id like ''chain:%'' then\n'
        || E'    res := jsonb_set(res, ''{client}'', jsonb_build_object(''id'', p_client_id,\n'
        || E'      ''name'', coalesce((select ch.name from chains ch where ch.id = substr(p_client_id, 7)), substr(p_client_id, 7)),\n'
        || E'      ''city'', null, ''region'', null, ''agent'', null, ''active'', true,\n'
        || E'      ''chain'', coalesce((select ch.name from chains ch where ch.id = substr(p_client_id, 7)), substr(p_client_id, 7)),\n'
        || E'      ''intergroup'', false, ''isChain'', true, ''stores'', array_length(members, 1)));\n'
        || E'  end if;\n  return res;\nend;');
      if newdef = def then raise exception 'chain_cards: result end not found in %', f.proname; end if;
      def := newdef;
    end if;
    execute def;
  end loop;
end;
$$;

-- Chains the caller may look at: name, how many of their stores are visible, net cash of the last 12 months.
create or replace function public.search_purchase_chains(p_company text, p_query text default '', p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; lim boolean; cur int; q text; res jsonb;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null then return '[]'::jsonb; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  cur := extract(year from (now() at time zone 'Asia/Jerusalem'))::int * 12 + extract(month from (now() at time zone 'Asia/Jerusalem'))::int;
  q := '%' || btrim(coalesce(p_query, '')) || '%';

  select coalesce(jsonb_agg(jsonb_build_object('id', 'chain:' || r.chain_id, 'name', r.name, 'stores', r.stores,
           'cash12', r.cash12, 'last', r.last_date) order by r.cash12 desc nulls last), '[]'::jsonb)
    into res
  from (
    select ch.id as chain_id, ch.name, count(distinct cc.client_id) as stores,
           sum(f.cash_sold - f.cash_returned) filter (where f.year * 12 + f.month > cur - 12) as cash12,
           max(f.last_date) as last_date
    from chains ch
    join client_chains cc on cc.chain_id = ch.id and cc.company = p_company
    left join purchase_facts f on f.company = p_company and f.client_id = cc.client_id
         and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
    where (not lim or cc.client_id in (select o.client_id from client_owner_v(p_company) o where o.agent_id = any(acc.agents)))
      and (btrim(coalesce(p_query, '')) = '' or ch.name ilike q or ch.id ilike q)
    group by ch.id, ch.name
    having count(distinct cc.client_id) > 0
  ) r;
  return res;
end;
$function$;
grant execute on function public.search_purchase_chains(text, text, uuid) to authenticated;

-- The stores of a chain, with the net cash of the last 12 months and last purchase date.
create or replace function public.get_chain_stores(p_company text, p_chain_id text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; lim boolean; cur int; res jsonb;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null then return '[]'::jsonb; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  cur := extract(year from (now() at time zone 'Asia/Jerusalem'))::int * 12 + extract(month from (now() at time zone 'Asia/Jerusalem'))::int;

  select coalesce(jsonb_agg(jsonb_build_object('id', r.client_id, 'name', r.name, 'city', r.city, 'agent', r.agent,
           'cash12', r.cash12, 'last', r.last_date) order by r.cash12 desc nulls last, r.name), '[]'::jsonb)
    into res
  from (
    select cc.client_id, max(c.name) as name, max(c.city) as city, max(o.agent_id) as agent,
           sum(f.cash_sold - f.cash_returned) filter (where f.year * 12 + f.month > cur - 12) as cash12,
           max(f.last_date) as last_date
    from client_chains cc
    join client_owner_v(p_company) o on o.client_id = cc.client_id
    left join clients c on c.company = cc.company and c.erp_client_id = cc.client_id
    left join purchase_facts f on f.company = cc.company and f.client_id = cc.client_id
         and f.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
    where cc.company = p_company and cc.chain_id = p_chain_id
      and (not lim or o.agent_id = any(acc.agents))
    group by cc.client_id
  ) r;
  return res;
end;
$function$;
grant execute on function public.get_chain_stores(text, text, uuid) to authenticated;

-- The chain a client belongs to (for the "view the whole chain" link), or null.
create or replace function public.get_client_chain(p_company text, p_client_id text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare acc dashboard_user_access; lim boolean; owner text;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  owner := client_owner_of(p_company, p_client_id);
  if lim and (owner is null or not (owner = any(acc.agents))) then return null; end if;
  return (select jsonb_build_object('id', 'chain:' || ch.id, 'name', ch.name,
            'stores', (select count(*) from client_chains x where x.company = p_company and x.chain_id = ch.id))
          from client_chains cc join chains ch on ch.id = cc.chain_id
          where cc.company = p_company and cc.client_id = p_client_id limit 1);
end;
$function$;
grant execute on function public.get_client_chain(text, text, uuid) to authenticated;
