-- Client card: how much of the credit notes could be cancel-and-reissue instead of goods coming back.
-- A credit line (negative cash in the sales report 891, or a line of the credit-notes report 855) is "matched" when the same
-- client has an invoice line for the same item and the same quantity from 90 days before to 30 days after it.
-- Same access rules as the card itself (owner scope, hidden years, View-as).

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
    select s.line_date, s.item_sku, s.qty, s.cash, s.year
    from sales_lines s
    where s.company = p_company and s.client_id = p_client_id
      and s.line_source like 'rep891%' and s.item_sku is not null
      and s.line_date >= since - 90
      and s.year <> all(coalesce(acc.hidden_years, '{}'::int[]))
  ),
  credits as (select * from l where cash < 0 and line_date >= since),
  matched as (
    select c.* from credits c
    where exists (select 1 from l p where p.item_sku = c.item_sku and p.cash > 0 and abs(p.qty + c.qty) < 0.01
                    and p.line_date between c.line_date - 90 and c.line_date + 30)
  )
  select jsonb_build_object(
    'credits12', (select coalesce(sum(-cash), 0) from credits),
    'matched12', (select coalesce(sum(-cash), 0) from matched),
    'creditLines12', (select count(*) from credits),
    'matchedLines12', (select count(*) from matched)
  ) into res;
  return res;
end;
$function$;
grant execute on function public.get_client_credit_check(text, text, uuid) to authenticated;
