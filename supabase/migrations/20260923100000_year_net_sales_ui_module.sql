-- Year sales graph (report 891) as a class-grantable suite feature.
-- Shown inside Sales Agent / Sales Manager; not a classic Oversight addon.

insert into public.app_ui_module (id, label, description, surface, kind, active, sort_order) values
  ('year_net_sales', 'Sales year graph (891)',
   'Calendar-year net sales from report 891. Checked on a class to show the graph inside Sales Agent / Sales Manager.',
   'oversight', 'addon', true, 40)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  surface = excluded.surface,
  kind = excluded.kind,
  active = excluded.active,
  sort_order = excluded.sort_order;

-- Default on for classes that already have a sales suite, so current users keep the graph.
insert into public.app_grant (class_id, kind, key, value, effect)
select c.id, 'node', 'ui.oversight.addon.year_net_sales', null, 'allow'
from public.app_class c
where c.id in ('agent', 'sales_manager')
  and not exists (
    select 1
    from public.app_grant g
    where g.class_id = c.id
      and g.kind = 'node'
      and g.key = 'ui.oversight.addon.year_net_sales'
      and g.value is null
  );
