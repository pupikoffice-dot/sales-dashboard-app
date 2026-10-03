-- Debt export: wide month columns (E–J) → bucket_date; 624 monthly stock-in; VAT hint for collections

alter table client_debt_lines add column if not exists agent_erp_id text;
alter table client_debt_lines add column if not exists bucket_date date;

comment on column client_debt_lines.bucket_date is
  'First day of calendar month for this debt bucket (from column header E–J).';
comment on column client_debt_lines.debt_month is
  'Legacy 1–12; prefer bucket_date for new syncs.';

alter table client_debt_lines drop constraint if exists client_debt_lines_company_erp_client_id_debt_month_key;

-- New sync rows always set bucket_date (first of month from E–J headers). Legacy nulls may exist.
create unique index if not exists client_debt_lines_bucket_uq
  on client_debt_lines (company, erp_client_id, bucket_date);

-- 624 import report: per item × month, cash value received into inventory (ILS)
create table item_monthly_stock_in (
  id            bigserial primary key,
  company       text not null check (company in ('pupik', 'mt', 'grow', 'gold')),
  year          smallint not null,
  month         smallint not null check (month between 1 and 12),
  supplier_id   text not null default '',
  sku           text not null,
  item_name     text,
  amount_ils    numeric,
  synced_at     timestamptz not null default now(),
  unique (company, year, month, sku, supplier_id)
);

create index item_monthly_stock_in_company_year_idx on item_monthly_stock_in (company, year);

alter table item_monthly_stock_in enable row level security;

create policy "item_monthly_stock_in_select" on item_monthly_stock_in
  for select to authenticated
  using (
    is_admin_or_above()
    or company in (select unnest(allowed_companies) from user_profiles where id = auth.uid())
  );

-- When answering “amount without VAT” on collection/receipt totals (Israel 18%)
insert into app_settings (key, value) values ('collections_vat_divisor', '1.18')
on conflict (key) do nothing;

comment on table item_monthly_stock_in is
  'ERP 624 report: inbound inventory value (ILS) per item per month; tabs named 624+YEAR.';
