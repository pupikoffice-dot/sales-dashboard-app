-- Report of SKU prefixes with RECENT sales activity (last ~120 days) that have
-- no supplier_prefix mapping yet, so genuinely new/active suppliers surface for
-- naming while long-dead prefixes drop off on their own. Filtered to real-looking
-- prefixes (leading letter, >=3 rows). Query anytime:
--   select * from unmapped_supplier_prefixes;
create or replace view public.unmapped_supplier_prefixes as
with s as (
  select company, upper(split_part(item_sku,'-',1)) prefix, item_name, line_date
  from sales_lines
  where item_sku is not null and item_sku <> '' and line_date >= current_date - interval '120 days'
)
select s.prefix,
       count(distinct s.company)                                          companies,
       count(*)                                                           rows_seen,
       (array_agg(s.item_name order by s.line_date desc) filter (where s.item_name is not null))[1] sample_name,
       max(s.line_date)                                                   last_seen
from s
left join supplier_prefix sp on sp.prefix = s.prefix
where sp.prefix is null
  and s.prefix ~ '^[A-Z]'
group by s.prefix
having count(*) >= 3
order by rows_seen desc;
