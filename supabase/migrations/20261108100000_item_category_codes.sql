-- Category number <-> description lookup, from the two ERP item exports:
--   item103<co>.xls  = category DESCRIPTIONS (columns "apyun 1..10", category 7 = column I = tablet_cat)
--   item104<co>.xls  = the same items with category NUMBERS (columns 1..10, one column to the left)
-- Items are paired by SKU; (company, level, code) -> description. description is null when the number appears in rep104
-- but has no description anywhere in rep103 (an undefined number, e.g. pupik 99 or the marker '--').
-- Rows are loaded by the service role (sync / admin script); the dashboard reads them through get_item_category_codes().
create table if not exists public.item_category_codes (
  company     text        not null,
  level       smallint    not null check (level between 1 and 10),
  code        text        not null check (btrim(code) <> ''),
  description text,
  items       integer     not null default 0,
  updated_at  timestamptz not null default now(),
  primary key (company, level, code)
);
alter table public.item_category_codes enable row level security;
revoke all on public.item_category_codes from public, anon, authenticated;

create or replace function public.get_item_category_codes(p_company text default null, p_level integer default 7)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare acc dashboard_user_access;
begin
  acc := cc_gate();
  if acc.user_id is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('co', c.company, 'level', c.level, 'code', c.code, 'description', c.description, 'items', c.items)
                     order by c.company, c.level, c.code)
    from item_category_codes c
    where c.level = p_level
      and c.company = any(acc.companies)
      and (p_company is null or c.company = p_company)
  ), '[]'::jsonb);
end;
$function$;
revoke all on function public.get_item_category_codes(text, integer) from public, anon;
grant execute on function public.get_item_category_codes(text, integer) to authenticated;
