-- Per-page permissions in every section (owner request 2026-11-08).
-- Before: the R&D section was two switches ('rnd' = Monthly + Multi-year + Yearly, 'purchase_insights' = Client card + Item card),
-- Stock by brand / Stock history followed 'stock', and Items was an opt-out ('date.items' hidden). Now every page is its own
-- grant in dashboard_user_access.modules:
--   operations: stock_brand, stock_history, items_index
--   R&D:        rnd_monthly, rnd_yearly (Multi-year data), rnd_year (Yearly data), rnd_client_card, rnd_item_card
-- Main and the other Operations pages (Sales, Orders MTD, Debt, Deliveries, Stock ...) were already individual grants.
-- Nobody loses access: step 1 gives each user exactly the pages they could open before.

-- 1) Backfill (idempotent).
update public.dashboard_user_access a
   set modules = array(select distinct m from unnest(
         coalesce(a.modules, '{}'::text[])
         || case when 'rnd' = any(coalesce(a.modules, '{}')) then array['rnd_monthly','rnd_yearly','rnd_year'] else '{}'::text[] end
         || case when 'purchase_insights' = any(coalesce(a.modules, '{}')) then array['rnd_client_card','rnd_item_card'] else '{}'::text[] end
         || case when 'stock' = any(coalesce(a.modules, '{}')) then array['stock_brand','stock_history'] else '{}'::text[] end
         || case when not ('date.items' = any(coalesce(a.hidden_sidebar, '{}'))) then array['items_index'] else '{}'::text[] end
       ) m);

-- 2) R&D gates take the page. p_page null = any page of that group (kept for callers not listed below).
drop function if exists public.rnd_gate(text, uuid);
create or replace function public.rnd_gate(p_company text, p_as uuid default null, p_page text default null)
 returns dashboard_user_access
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare acc dashboard_user_access; previewing boolean;
begin
  previewing := p_as is not null and p_as <> auth.uid() and is_super_admin();
  acc := get_dashboard_access(case when previewing then p_as else auth.uid() end);
  if acc.user_id is null or p_company is null or not (p_company = any(acc.companies)) then return null; end if;
  if acc.agents is not null and array_length(acc.agents, 1) is not null then return null; end if;
  if not ((not previewing and is_super_admin()) or (
        case when p_page is null then coalesce(acc.modules, '{}'::text[]) && array['rnd_monthly','rnd_yearly','rnd_year']
             else p_page = any(coalesce(acc.modules, '{}'::text[])) end)) then return null; end if;
  return acc;
end;
$function$;
revoke all on function public.rnd_gate(text, uuid, text) from public, anon, authenticated;
grant execute on function public.rnd_gate(text, uuid, text) to service_role;

drop function if exists public.purchase_cards_gate(text, uuid);
create or replace function public.purchase_cards_gate(p_company text, p_as uuid default null, p_page text default null)
 returns dashboard_user_access
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare acc dashboard_user_access; previewing boolean;
begin
  previewing := p_as is not null and p_as <> auth.uid() and is_super_admin();
  acc := get_dashboard_access(case when previewing then p_as else auth.uid() end);
  if acc.user_id is null or p_company is null or not (p_company = any(acc.companies)) then return null; end if;
  if not ((not previewing and is_super_admin()) or (
        case when p_page is null then coalesce(acc.modules, '{}'::text[]) && array['rnd_client_card','rnd_item_card']
             else p_page = any(coalesce(acc.modules, '{}'::text[])) end)) then return null; end if;
  return acc;
end;
$function$;
revoke all on function public.purchase_cards_gate(text, uuid, text) from public, anon, authenticated;
grant execute on function public.purchase_cards_gate(text, uuid, text) to service_role;

-- 3) Tell every caller which page it serves, and add the page checks to Items and Stock. Each pattern must exist, or the migration stops.
do $$
declare
  r record; d text; nd text; n int;
  m text[][] := array[
    ['get_monthly_margin','rnd_gate','rnd_monthly'],
    ['get_yearly_detail','rnd_gate','rnd_year'],
    ['get_yearly_detail_margin','rnd_gate','rnd_year'],
    ['get_yearly_margin','rnd_gate','rnd_yearly'],
    ['get_yearly_overview','rnd_gate','rnd_yearly'],
    ['get_client_card','purchase_cards_gate','rnd_client_card'],
    ['get_client_card_margin','purchase_cards_gate','rnd_client_card'],
    ['get_client_chain','purchase_cards_gate','rnd_client_card'],
    ['get_client_credit_check','purchase_cards_gate','rnd_client_card'],
    ['get_client_vs_last_year','purchase_cards_gate','rnd_client_card'],
    ['get_client_item_sales','purchase_cards_gate','rnd_client_card'],
    ['search_purchase_clients','purchase_cards_gate','rnd_client_card'],
    ['search_purchase_chains','purchase_cards_gate','rnd_client_card'],
    ['get_chain_stores','purchase_cards_gate','rnd_client_card'],
    ['get_item_card','purchase_cards_gate','rnd_item_card'],
    ['get_item_card_margin','purchase_cards_gate','rnd_item_card'],
    ['get_item_vs_last_year','purchase_cards_gate','rnd_item_card'],
    ['search_purchase_items','purchase_cards_gate','rnd_item_card']
  ];
  i int;
begin
  for i in 1 .. array_length(m, 1) loop
    n := 0;
    for r in select p.oid from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = m[i][1] and p.prokind = 'f' loop
      d := pg_get_functiondef(r.oid);
      nd := regexp_replace(d, m[i][2] || '\(([^()]*)\)', m[i][2] || '(\1, ''' || m[i][3] || ''')', 'g');
      if nd = d then raise exception '% (%): no call to % found', m[i][1], r.oid, m[i][2]; end if;
      execute nd;
      n := n + 1;
    end loop;
    if n = 0 then raise exception 'function % not found', m[i][1]; end if;
  end loop;

  -- Items: the Items index functions and the category-control gate also require the items_index page (real super admin always passes).
  for r in select p.oid, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
           and p.proname in ('cc_gate', 'get_item_index', 'get_item_category_restore') loop
    d := pg_get_functiondef(r.oid);
    if position('''date.items'' = any(coalesce(acc.hidden_sidebar, ''{}''))' in d) = 0 then raise exception '%: date.items check not found', r.proname; end if;
    execute replace(d, '''date.items'' = any(coalesce(acc.hidden_sidebar, ''{}''))',
      '(''date.items'' = any(coalesce(acc.hidden_sidebar, ''{}'')) or not (is_super_admin() or ''items_index'' = any(coalesce(acc.modules, ''{}''))))');
  end loop;

  -- Stock by brand (get_stock_by_brand, get_stock_items) and Stock history (get_stock_history, get_stock_daily).
  for r in select p.oid, p.proname from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
           and p.proname in ('get_stock_by_brand', 'get_stock_items', 'get_stock_history', 'get_stock_daily') loop
    d := pg_get_functiondef(r.oid);
    declare
      page text := case when r.proname in ('get_stock_by_brand', 'get_stock_items') then 'stock_brand' else 'stock_history' end;
      pat text := case r.proname
        when 'get_stock_by_brand' then 'if acc.user_id is null then'
        when 'get_stock_items' then 'if acc.user_id is null then'
        when 'get_stock_history' then 'if acc.user_id is null or p_company is null'
        else 'if acc.user_id is null or not (p_company = any(acc.companies)) then' end;
    begin
      if position(pat in d) = 0 then raise exception '%: pattern not found', r.proname; end if;
      execute replace(d, pat, replace(pat, 'acc.user_id is null', 'acc.user_id is null or not (is_super_admin() or ''' || page || ''' = any(coalesce(acc.modules, ''{}'')))'));
    end;
  end loop;
end $$;
