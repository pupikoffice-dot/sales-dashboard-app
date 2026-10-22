-- Stock history screen (Operations -> Stock history): opening and closing stock per item for one day, or a range.
-- Real days come from inventory_daily (first and last reading of the day); days before the first reading are the
-- rebuilt values in stock_daily (estimated = true). Opening of a rebuilt day = closing of the day before.
-- Only the user's own companies; at most 62 days per call. Quantities only, no cost.

create or replace function public.get_stock_history(p_company text, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access;
  res jsonb;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null or p_company is null or not (p_company = any(acc.companies)) then
    return jsonb_build_object('rows', '[]'::jsonb, 'first', null, 'last', null);
  end if;
  if p_from is null or p_to is null or p_to < p_from then
    return jsonb_build_object('rows', '[]'::jsonb, 'first', null, 'last', null);
  end if;
  if p_to - p_from > 61 then p_from := p_to - 61; end if;

  with sd as (
    select sku, day, close_qty, estimated,
           lag(close_qty) over (partition by sku order by day) as prev_close
    from stock_daily
    where company = p_company and day between p_from - 1 and p_to
  )
  select jsonb_build_object(
    'first', (select min(day) from stock_daily where company = p_company),
    'last',  (select max(day) from stock_daily where company = p_company),
    'rows', coalesce(jsonb_agg(jsonb_build_object(
        'day', sd.day, 'sku', sd.sku,
        'name', coalesce(nullif(d.name, ''), p.name, ''),
        'open', coalesce(d.open_qty, sd.prev_close),
        'close', sd.close_qty,
        'est', sd.estimated
      ) order by sd.day, sd.sku), '[]'::jsonb))
  into res
  from sd
  left join inventory_daily d on d.company = p_company and d.sku = sd.sku and d.day = sd.day
  left join item_pricing p on p.company = p_company and p.sku = sd.sku
  where sd.day between p_from and p_to
    and (sd.close_qty <> 0 or coalesce(d.open_qty, sd.prev_close, 0) <> 0);

  return res;
end;
$function$;
grant execute on function public.get_stock_history(text, date, date) to authenticated;
