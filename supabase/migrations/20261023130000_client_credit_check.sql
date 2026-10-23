-- Client card: what the credit notes of the last 12 months look like. The sales report has no reason on a credit line, so
-- each credit line is classified by what the same client did with the same item:
--   reissued   an invoice line with the same item and quantity follows within 30 days  -> cancelled and invoiced again
--   reverses   an invoice line with the same item and quantity exists in the 90 days before, no reissue -> a whole earlier line reversed
--   other      neither -> partial quantity, an older invoice, or a price credit
-- (Pupik, last 12 months overall: about 7% reissued, 35% reverses, 58% other.)
-- Same access rules as the card itself (owner scope, hidden years, View-as).

drop function if exists public.get_client_credit_check(text, text, uuid);

create or replace function public.get_client_credit_check(p_company text, p_client_id text, p_as uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare acc dashboard_user_access; lim boolean; owner text; res jsonb; since date;
begin
  acc := purchase_cards_gate(p_company, p_as);
  if acc.user_id is null then return null; end if;
  lim := acc.agents is not null and array_length(acc.agents, 1) is not null;
  owner := client_owner_of(p_company, p_client_id);
  if lim and (owner is null or not (owner = any(acc.agents))) then return null; end if;
  since := ((now() at time zone 'Asia/Jerusalem')::date - interval '12 months')::date;

  with l as (
    select s.line_date, s.item_sku, s.qty, s.cash
    from sales_lines s
    where s.company = p_company and s.client_id = p_client_id
      and s.line_source like 'rep891%' and s.item_sku is not null
      and s.line_date >= since - 90
      and s.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
  ),
  credits as (select * from l where cash < 0 and line_date >= since),
  tagged as (
    select c.cash,
      exists (select 1 from l p where p.item_sku = c.item_sku and p.cash > 0 and abs(p.qty + c.qty) < 0.01
                and p.line_date > c.line_date and p.line_date <= c.line_date + 30) as reissued,
      exists (select 1 from l p where p.item_sku = c.item_sku and p.cash > 0 and abs(p.qty + c.qty) < 0.01
                and p.line_date between c.line_date - 90 and c.line_date) as earlier
    from credits c
  )
  select jsonb_build_object(
    'credits12', (select coalesce(sum(-cash), 0) from tagged),
    'reissued12', (select coalesce(sum(-cash) filter (where reissued), 0) from tagged),
    'reverses12', (select coalesce(sum(-cash) filter (where not reissued and earlier), 0) from tagged),
    'other12', (select coalesce(sum(-cash) filter (where not reissued and not earlier), 0) from tagged),
    'creditLines12', (select count(*) from tagged)
  ) into res;
  return res;
end;
$function$;
grant execute on function public.get_client_credit_check(text, text, uuid) to authenticated;
