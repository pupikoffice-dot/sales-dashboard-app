-- Search sales: credits follow the client card's return-reason rules. A document-14 credit line counts as a return (isReturn)
-- unless the 855 returns report gives it a reason that does not count as a return (return_reason_rules.counts_as_return = false);
-- those lines stay in "sold" as negatives, exactly as refresh_purchase_facts books them, so gross sold, returned and net
-- equal the card's figures for the same client and item.

create or replace function public.get_client_item_sales(
  p_company text,
  p_client_id text,
  p_query text,
  p_from date default null,
  p_to date default null,
  p_as uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access; lim boolean; owner text; members text[]; tokens text[];
  q text; total bigint; res jsonb;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null or p_client_id is null then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  if p_client_id like 'chain:%' then
    select coalesce(array_agg(cc.client_id), '{}') into members
    from client_chains cc
    where cc.company = p_company and cc.chain_id = substr(p_client_id, 7)
      and (not lim or cc.client_id in (select o.client_id from client_owner_v(p_company) o where o.agent_id = any(acc.agents)));
    if coalesce(array_length(members, 1), 0) = 0 then return null; end if;
  else
    owner := client_owner_of(p_company, p_client_id);
    if lim and (owner is null or not (owner = any(acc.agents))) then return null; end if;
    members := array[p_client_id];
  end if;

  q := lower(btrim(coalesce(p_query, '')));
  if q = '' then return jsonb_build_object('total', 0, 'rows', '[]'::jsonb); end if;
  tokens := regexp_split_to_array(q, '\s+');

  select count(*) into total
  from sales_lines s
  where s.company = p_company and s.client_id = any(members)
    and s.line_source like 'rep891%' and s.item_sku is not null
    and s.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
    and (p_from is null or s.line_date >= p_from) and (p_to is null or s.line_date <= p_to)
    and not exists (select 1 from unnest(tokens) t
                    where strpos(lower(s.item_sku || ' ' || coalesce(s.item_name, '')), t) = 0);

  select jsonb_build_object('total', total, 'rows', coalesce(jsonb_agg(jsonb_build_object(
           'date', to_char(r.line_date, 'YYYY-MM-DD'), 'docNum', coalesce(r.doc_num, ''), 'docType', coalesce(r.doc_type, ''),
           'clientID', r.client_id, 'sku', r.item_sku, 'name', coalesce(r.item_name, ''),
           'qty', r.qty, 'cash', r.cash,
           'price', case when coalesce(r.qty, 0) <> 0 then round(r.cash / r.qty, 4) end,
           'discountPct', r.discount_pct, 'discountCash', r.discount_cash,
           'isReturn', r.is_return)
         order by r.line_date desc, r.id desc), '[]'::jsonb))
    into res
  from (
    select s.id, s.line_date, s.doc_num, s.doc_type, s.client_id, s.item_sku, s.item_name, s.qty, s.cash,
           s.discount_pct, s.discount_cash,
           (s.doc_type = '14' and s.cash < 0 and not exists (
              select 1 from sales_lines r2
              join return_reason_rules u on u.company = r2.company and u.code = r2.return_reason_code and not u.counts_as_return
              where r2.company = p_company and r2.line_source = '855'
                and r2.client_id = s.client_id and r2.item_sku = s.item_sku and r2.line_date = s.line_date
                and round(abs(r2.qty), 2) = round(abs(s.qty), 2))) as is_return
    from sales_lines s
    where s.company = p_company and s.client_id = any(members)
      and s.line_source like 'rep891%' and s.item_sku is not null
      and s.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (p_from is null or s.line_date >= p_from) and (p_to is null or s.line_date <= p_to)
      and not exists (select 1 from unnest(tokens) t
                      where strpos(lower(s.item_sku || ' ' || coalesce(s.item_name, '')), t) = 0)
    order by s.line_date desc, s.id desc
    limit 5000
  ) r;
  return res;
end;
$function$;
revoke all on function public.get_client_item_sales(text, text, text, date, date, uuid) from public, anon;
grant execute on function public.get_client_item_sales(text, text, text, date, date, uuid) to authenticated;
