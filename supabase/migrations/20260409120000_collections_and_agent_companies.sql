-- Payment/collection lines (collect008-style exports) and per-user company access for agents/managers.

-- ─── user_profiles: which ERP companies this user may see (RLS) ─────────────
alter table user_profiles
  add column if not exists allowed_companies text[]
  not null default array['pupik', 'mt', 'grow', 'gold']::text[];

comment on column user_profiles.allowed_companies is
  'Subset of operating companies (pupik, mt, grow, gold) visible to this user. Admins ignore this in RLS.';

-- ─── client_payment_receipts: one row per client payment / receipt ───────────
create table client_payment_receipts (
  id                   bigserial primary key,
  company              text not null
    check (company in ('pupik', 'mt', 'grow', 'gold')),
  agent_erp_id         text,
  erp_client_id        text not null,
  client_name          text,
  receipt_num          text not null,
  receipt_issued_date  date,
  payment_due_date     date,
  amount_paid          numeric,
  city                 text,
  synced_at            timestamptz not null default now(),
  unique (company, receipt_num)
);

create index client_payment_receipts_client_idx on client_payment_receipts (erp_client_id);
create index client_payment_receipts_company_idx on client_payment_receipts (company);
create index client_payment_receipts_agent_idx on client_payment_receipts (agent_erp_id);

alter table client_payment_receipts enable row level security;

-- ─── Replace RLS: enforce allowed_companies for non-admin users ──────────────

drop policy if exists "clients_select" on clients;
create policy "clients_select" on clients
  for select to authenticated
  using (
    is_admin_or_above()
    or (
      company in (select unnest(allowed_companies) from user_profiles where id = auth.uid())
      and (
        assigned_agent_id = auth.uid()
        or assigned_agent_id in (select get_subtree_agent_ids(auth.uid()))
      )
    )
  );

drop policy if exists "sales_select_agent" on sales_lines;
create policy "sales_select_agent" on sales_lines
  for select to authenticated
  using (
    is_admin_or_above()
    or (
      company in (select unnest(allowed_companies) from user_profiles where id = auth.uid())
      and (
        exists (
          select 1 from clients c
          where c.erp_client_id = sales_lines.client_id
            and c.company = sales_lines.company
            and c.assigned_agent_id = auth.uid()
        )
        or exists (
          select 1 from clients c
          where c.erp_client_id = sales_lines.client_id
            and c.company = sales_lines.company
            and c.assigned_agent_id in (select get_subtree_agent_ids(auth.uid()))
        )
      )
    )
  );

drop policy if exists "inventory_select" on inventory;
create policy "inventory_select" on inventory
  for select to authenticated
  using (
    is_admin_or_above()
    or company in (select unnest(allowed_companies) from user_profiles where id = auth.uid())
  );

drop policy if exists "sku_pricing_select" on sku_pricing;
create policy "sku_pricing_select" on sku_pricing
  for select to authenticated
  using (
    is_admin_or_above()
    or company in (select unnest(allowed_companies) from user_profiles where id = auth.uid())
  );

-- Payment receipts: same visibility as sales_lines (assigned client + company access)
create policy "client_payment_receipts_select" on client_payment_receipts
  for select to authenticated
  using (
    is_admin_or_above()
    or (
      company in (select unnest(allowed_companies) from user_profiles where id = auth.uid())
      and (
        exists (
          select 1 from clients c
          where c.erp_client_id = client_payment_receipts.erp_client_id
            and c.company = client_payment_receipts.company
            and c.assigned_agent_id = auth.uid()
        )
        or exists (
          select 1 from clients c
          where c.erp_client_id = client_payment_receipts.erp_client_id
            and c.company = client_payment_receipts.company
            and c.assigned_agent_id in (select get_subtree_agent_ids(auth.uid()))
        )
      )
    )
  );

-- Prevent agents (and unauthorized users) from widening company access via PostgREST.
create or replace function enforce_allowed_companies_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if new.allowed_companies is not distinct from old.allowed_companies then
    return new;
  end if;
  if uid is null then
    return new;
  end if;
  if exists (
    select 1 from user_profiles where id = uid and role in ('super_admin', 'admin')
  ) then
    return new;
  end if;
  if exists (
    select 1 from user_profiles up
    where up.id = uid and up.role = 'manager'
      and new.id in (select get_subtree_ids(uid))
  ) then
    return new;
  end if;
  raise exception 'allowed_companies may only be changed by admin or a manager editing a user in their subtree';
end;
$$;

drop trigger if exists user_profiles_allowed_companies_guard on user_profiles;
create trigger user_profiles_allowed_companies_guard
  before update on user_profiles
  for each row
  execute function enforce_allowed_companies_edit();
