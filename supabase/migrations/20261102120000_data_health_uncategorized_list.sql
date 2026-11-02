-- Full list of in-stock items without a category, for the daily data-health email (service role only).
-- Same definition as get_uncategorized_stock() (migration 20261102100000) but for the pupik and mt companies, no user gate.
create or replace function public.data_health_uncategorized()
returns table(company text, sku text, name text, qty numeric)
language sql stable security definer set search_path to 'public' set statement_timeout to '30s' as $$
  with stock as (
    select i.company, i.sku, sum(i.qty_on_hand) as qty, max(i.name) as inv_name
    from inventory i
    where i.company in ('pupik', 'mt') and btrim(i.sku) <> 'סך הכל'
    group by i.company, i.sku
    having sum(i.qty_on_hand) > 0
  ),
  latest as (
    select c.company, max(c.synced_at) as m from item_catalog c where c.company in ('pupik', 'mt') group by c.company
  ),
  cat as (
    select c.company, c.sku, c.tablet_cat
    from item_catalog c join latest l on l.company = c.company and c.synced_at >= l.m - interval '2 hours'
  )
  select s.company, s.sku, coalesce(nullif(p.name, ''), s.inv_name, '') as name, s.qty
  from stock s
  left join cat c on c.company = s.company and c.sku = s.sku
  left join item_pricing p on p.company = s.company and p.sku = s.sku
  where nullif(btrim(c.tablet_cat), '') is null
  order by s.company, s.qty desc, s.sku;
$$;
revoke all on function public.data_health_uncategorized() from public, anon, authenticated;
grant execute on function public.data_health_uncategorized() to service_role;
