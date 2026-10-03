-- Remove the demo rows inserted by 20260405120000_seed_demo_data.sql.
-- They were test data from the first setup (before real ERP data existed). The sync replaces data
-- per source file, so it never touched these: 4 sales lines with no line_source and 2 price rows with
-- made-up SKUs stayed in production, adding 7,990.50 of fake sales to March/April 2026.
-- The seed's clients and inventory rows were already overwritten by the sync.
-- Conditions match only the seeded values, so this is a no-op where they are absent (e.g. BETA).

delete from sales_lines
where line_source is null
  and client_name in ('Seed Client Pupik', 'Seed Client MT', 'Seed Client Grow')
  and doc_num in ('INV-9001', 'INV-9002', 'INV-8001', 'CN-7001')
  and item_sku in ('SKU-100', 'SKU-101', 'SKU-200', 'SKU-300');

delete from sku_pricing
where (sku, company, cost, list_price) in (('SKU-100', 'pupik', 80.00, 220.00),
                                           ('SKU-200', 'mt',    500.00, 900.00));
