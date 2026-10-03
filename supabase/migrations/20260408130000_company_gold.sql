-- Fourth operating company used in ERP filenames (e.g. *gold*.xls)
alter table clients drop constraint if exists clients_company_check;
alter table clients add constraint clients_company_check
  check (company in ('pupik', 'mt', 'grow', 'gold'));

alter table sales_lines drop constraint if exists sales_lines_company_check;
alter table sales_lines add constraint sales_lines_company_check
  check (company in ('pupik', 'mt', 'grow', 'gold'));

alter table inventory drop constraint if exists inventory_company_check;
alter table inventory add constraint inventory_company_check
  check (company in ('pupik', 'mt', 'grow', 'gold'));

alter table sku_pricing drop constraint if exists sku_pricing_company_check;
alter table sku_pricing add constraint sku_pricing_company_check
  check (company in ('pupik', 'mt', 'grow', 'gold'));
