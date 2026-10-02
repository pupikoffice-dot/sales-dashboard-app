-- Demo / dev seed aligned with Dashboard export fields (ExportDashboardData.bas).
-- Re-run safe: removes prior seed sales lines, upserts clients.
-- Clients get assigned_agent_id = first active agent if one exists; else NULL (assign in admin).

delete from sales_lines
where client_id in ('SEED-PUP-001', 'SEED-MT-001', 'SEED-G-001');

insert into clients (erp_client_id, name, company, phone, email, region, active, assigned_agent_id)
values
  (
    'SEED-PUP-001',
    'Seed Client Pupik',
    'pupik',
    '050-0000001',
    'seed.pupik@example.com',
    'Center',
    true,
    (select id from user_profiles where role = 'agent' and active = true order by created_at limit 1)
  ),
  (
    'SEED-MT-001',
    'Seed Client MT',
    'mt',
    '050-0000002',
    'seed.mt@example.com',
    'North',
    true,
    (select id from user_profiles where role = 'agent' and active = true order by created_at limit 1)
  ),
  (
    'SEED-G-001',
    'Seed Client Grow',
    'grow',
    '050-0000003',
    'seed.grow@example.com',
    'South',
    true,
    (select id from user_profiles where role = 'agent' and active = true order by created_at limit 1)
  )
on conflict (erp_client_id, company) do update set
  name              = excluded.name,
  phone             = excluded.phone,
  email             = excluded.email,
  region            = excluded.region,
  active            = excluded.active,
  assigned_agent_id = coalesce(excluded.assigned_agent_id, clients.assigned_agent_id);

insert into sales_lines (
  line_date, year, month, agent_erp_id, client_id, client_name, doc_type, doc_num,
  item_sku, barcode, item_name, qty, cash, tablet_cat, group_cat, supplier, brand, company
) values
  ('2026-03-15', 2026, 3, '24', 'SEED-PUP-001', 'Seed Client Pupik', 'INV', 'INV-9001',
   'SKU-100', '7290001111222', 'Demo product A', 12, 2400.00, 'CatA', 'Grp1', 'SUP1', 'BrandX', 'pupik'),
  ('2026-03-20', 2026, 3, '24', 'SEED-PUP-001', 'Seed Client Pupik', 'INV', 'INV-9002',
   'SKU-101', '7290001111223', 'Demo product B', 4, 890.50, 'CatB', 'Grp1', 'SUP2', 'BrandY', 'pupik'),
  ('2026-04-01', 2026, 4, '24', 'SEED-MT-001', 'Seed Client MT', 'INV', 'INV-8001',
   'SKU-200', '7290002222333', 'Demo MT line', 2, 1500.00, 'CatA', 'Grp2', 'SUP1', 'BrandZ', 'mt'),
  ('2026-04-02', 2026, 4, '24', 'SEED-G-001', 'Seed Client Grow', 'CN', 'CN-7001',
   'SKU-300', '7290003333444', 'Demo Grow line', 10, 3200.00, 'CatC', 'Grp3', 'SUP3', 'BrandG', 'grow');

insert into inventory (sku, name, qty_on_hand, company)
values
  ('SKU-100', 'Demo product A', 500, 'pupik'),
  ('SKU-200', 'Demo MT line', 120, 'mt')
on conflict (sku, company) do update set
  name        = excluded.name,
  qty_on_hand = excluded.qty_on_hand;

insert into sku_pricing (sku, cost, list_price, company)
values
  ('SKU-100', 80.00, 220.00, 'pupik'),
  ('SKU-200', 500.00, 900.00, 'mt')
on conflict (sku, company) do update set
  cost       = excluded.cost,
  list_price = excluded.list_price;
