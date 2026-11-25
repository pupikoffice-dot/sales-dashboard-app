-- R&D Expenses: the super admin can add, rename, reorder and delete categories.
-- Built-in categories (the ones the loader assigns by card name) can be renamed but never deleted, because the loader would
-- keep writing their code. Categories the owner adds get a code starting with 'x_' and can be deleted when no card uses them.

create or replace function public.save_expense_category(p_code text, p_label text)
 returns text
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_label text := btrim(coalesce(p_label, ''));
  v_code  text := nullif(btrim(coalesce(p_code, '')), '');
begin
  if not is_super_admin() then raise exception 'not allowed'; end if;
  if v_label = '' then raise exception 'category name is empty'; end if;
  if exists (select 1 from expense_categories where lower(label) = lower(v_label) and code is distinct from v_code) then
    raise exception 'a category named "%" already exists', v_label;
  end if;
  if v_code is null then
    v_code := 'x_' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);
    insert into expense_categories (code, label, sort_order)
    values (v_code, v_label, coalesce((select max(sort_order) from expense_categories where code <> 'unclassified'), 0) + 1);
    -- "Unclassified" always stays last
    update expense_categories set sort_order = (select max(sort_order) from expense_categories where code <> 'unclassified') + 1
     where code = 'unclassified';
  else
    update expense_categories set label = v_label where code = v_code;
    if not found then raise exception 'unknown category %', v_code; end if;
  end if;
  return v_code;
end;
$function$;

-- Move a category one place up (-1) or down (+1) in the list.
create or replace function public.move_expense_category(p_code text, p_dir int)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_order int;
  v_other text;
  v_other_order int;
begin
  if not is_super_admin() then raise exception 'not allowed'; end if;
  select sort_order into v_order from expense_categories where code = p_code;
  if not found then raise exception 'unknown category %', p_code; end if;
  if p_dir < 0 then
    select code, sort_order into v_other, v_other_order from expense_categories where sort_order < v_order order by sort_order desc limit 1;
  else
    select code, sort_order into v_other, v_other_order from expense_categories where sort_order > v_order order by sort_order limit 1;
  end if;
  if v_other is null then return; end if;
  update expense_categories set sort_order = v_other_order where code = p_code;
  update expense_categories set sort_order = v_order where code = v_other;
end;
$function$;

create or replace function public.delete_expense_category(p_code text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not is_super_admin() then raise exception 'not allowed'; end if;
  if p_code not like 'x\_%' then raise exception 'built-in categories cannot be deleted (rename them instead)'; end if;
  if exists (select 1 from expense_cards where category = p_code) then
    raise exception 'cards still use this category - move them to another category first';
  end if;
  delete from expense_categories where code = p_code;
end;
$function$;

revoke all on function public.save_expense_category(text, text) from public, anon;
revoke all on function public.move_expense_category(text, int) from public, anon;
revoke all on function public.delete_expense_category(text) from public, anon;
grant execute on function public.save_expense_category(text, text) to authenticated;
grant execute on function public.move_expense_category(text, int) to authenticated;
grant execute on function public.delete_expense_category(text) to authenticated;
