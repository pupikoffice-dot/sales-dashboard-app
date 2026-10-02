-- Provenance for sales rows + item103 category lookup + debt exports

alter table sales_lines add column if not exists line_source text;

comment on column sales_lines.line_source is
  'Optional sync provenance e.g. 624:2023, 887-external, rep891pupik2025.';

-- item103: ERP item → categories (Module1 uses cols A=SKU, G & I for rep enrichment)
create table item_catalog (
  id          uuid primary key default gen_random_uuid(),
  sku         text not null,
  company     text not null check (company in ('pupik', 'mt', 'grow', 'gold')),
  erp_category_g text,
  erp_category_i text,
  synced_at   timestamptz not null default now(),
  unique (sku, company)
);

create index item_catalog_company_idx on item_catalog (company);

-- Open debt / aging buckets (month = invoice-month bucket per ops)
create table client_debt_lines (
  id             bigserial primary key,
  company        text not null check (company in ('pupik', 'mt', 'grow', 'gold')),
  erp_client_id  text not null,
  client_name    text,
  debt_month     smallint,
  amount         numeric,
  note           text,
  synced_at      timestamptz not null default now(),
  unique (company, erp_client_id, debt_month)
);

create index client_debt_lines_client_idx on client_debt_lines (erp_client_id);
create index client_debt_lines_company_idx on client_debt_lines (company);

alter table item_catalog enable row level security;
alter table client_debt_lines enable row level security;

create policy "item_catalog_select" on item_catalog
  for select to authenticated
  using (
    is_admin_or_above()
    or company in (select unnest(allowed_companies) from user_profiles where id = auth.uid())
  );

create policy "client_debt_lines_select" on client_debt_lines
  for select to authenticated
  using (
    is_admin_or_above()
    or (
      company in (select unnest(allowed_companies) from user_profiles where id = auth.uid())
      and (
        exists (
          select 1 from clients c
          where c.erp_client_id = client_debt_lines.erp_client_id
            and c.company = client_debt_lines.company
            and c.assigned_agent_id = auth.uid()
        )
        or exists (
          select 1 from clients c
          where c.erp_client_id = client_debt_lines.erp_client_id
            and c.company = client_debt_lines.company
            and c.assigned_agent_id in (select get_subtree_agent_ids(auth.uid()))
        )
      )
    )
  );
