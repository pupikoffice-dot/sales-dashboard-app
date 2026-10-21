-- Restriction Qty from REP907 (Pupik column M, Monkeytime column L): the most pieces of one item a client may put
-- on a single order. Empty or 0 in the file means no limit and is stored as null; only a positive whole number is a
-- limit. Not sensitive (a customer sees it in the ordering systems), so it lives in item_pricing next to the list price.
-- Chain: ERP 907 -> this table -> hub feed ("items" rows carry restriction_qty) -> B2B portal -> e-shop.
alter table public.item_pricing
  add column if not exists restriction_qty integer
  check (restriction_qty is null or restriction_qty >= 1);
comment on column public.item_pricing.restriction_qty is
  'Max pieces per order for this item (REP907 Pupik M / Monkeytime L); null = no limit.';
