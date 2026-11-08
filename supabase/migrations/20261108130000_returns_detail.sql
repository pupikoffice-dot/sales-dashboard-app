-- What the returns on a client card / item card are made of (owner request 2026-11-08).
-- Same definition as the card's returned figure: a document-14 credit line (891 report) is a return unless the 855 returns
-- report gives it a reason marked counts_as_return = false (return_reason_rules). Window = the card's "last 12 months"
-- (the current calendar month and the 11 before it). The reason comes from the matching 855 line (client, item, quantity, date).
-- Exactly one of p_client_id (a client or 'chain:<id>') and p_sku is given; the page grant is checked for that card.
create or replace function public.get_returns_detail(
  p_company text,
  p_client_id text default null,
  p_sku text default null,
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
  acc dashboard_user_access; lim boolean; members text[]; owner text; mine text[]; cur int; since date; res jsonb;
begin
  if (p_client_id is null) = (p_sku is null) then return null; end if;
  acc := purchase_cards_gate(p_company, p_as, case when p_client_id is not null then 'rnd_client_card' else 'rnd_item_card' end);
  if acc.user_id is null then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  if p_client_id is not null then
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
  elsif lim then
    select coalesce(array_agg(o.client_id), '{}') into mine from client_owner_v(p_company) o where o.agent_id = any(acc.agents);
  end if;
  cur := extract(year from (now() at time zone 'Asia/Jerusalem'))::int * 12 + extract(month from (now() at time zone 'Asia/Jerusalem'))::int;
  since := make_date((cur - 11 - 1) / 12, ((cur - 11 - 1) % 12) + 1, 1);

  with r as (
    select s.id, s.line_date, s.doc_num, s.client_id, s.item_sku, s.item_name, abs(s.qty) as qty, abs(s.cash) as cash,
           x.code, x.txt
    from sales_lines s
    left join lateral (
      select max(r2.return_reason_code) as code, max(r2.return_reason) as txt
      from sales_lines r2
      where r2.company = p_company and r2.line_source = '855'
        and r2.client_id = s.client_id and r2.item_sku = s.item_sku and r2.line_date = s.line_date
        and round(abs(r2.qty), 2) = round(abs(s.qty), 2)
    ) x on true
    where s.company = p_company and s.line_source like 'rep891%' and s.doc_type = '14' and s.cash < 0 and s.item_sku is not null and s.client_id is not null
      and s.line_date >= since
      and s.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
      and (case when p_client_id is not null then s.client_id = any(members)
                else s.item_sku = p_sku and (not lim or s.client_id = any(mine)) end)
      and not exists (
        select 1 from sales_lines r3
        join return_reason_rules u on u.company = r3.company and u.code = r3.return_reason_code and not u.counts_as_return
        where r3.company = p_company and r3.line_source = '855'
          and r3.client_id = s.client_id and r3.item_sku = s.item_sku and r3.line_date = s.line_date
          and round(abs(r3.qty), 2) = round(abs(s.qty), 2))
  ),
  named as (
    select r.*, coalesce(nullif(c.name, ''), r.client_id) as client_name
    from r left join clients c on c.company = p_company and c.erp_client_id = r.client_id
  )
  select jsonb_build_object(
    'lines', (select count(*) from named),
    'qty', (select coalesce(sum(qty), 0) from named),
    'cash', (select coalesce(sum(cash), 0) from named),
    'withReason', (select count(*) from named where code is not null),
    'reasons', (select coalesce(jsonb_agg(jsonb_build_object('code', code, 'text', txt, 'qty', q, 'cash', cash, 'lines', n) order by cash desc), '[]'::jsonb)
                from (select code, max(txt) as txt, sum(qty) as q, sum(cash) as cash, count(*) as n from named group by code) g),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object(
               'date', to_char(line_date, 'YYYY-MM-DD'), 'docNum', coalesce(doc_num, ''), 'clientID', client_id, 'client', client_name,
               'sku', item_sku, 'name', coalesce(item_name, ''), 'qty', qty, 'cash', cash, 'code', code, 'reason', txt)
               order by line_date desc, id desc), '[]'::jsonb)
             from (select * from named order by line_date desc, id desc limit 500) t)
  ) into res;
  return res;
end;
$function$;
revoke all on function public.get_returns_detail(text, text, text, uuid) from public, anon;
grant execute on function public.get_returns_detail(text, text, text, uuid) to authenticated;
