-- Sales Agent Oversight suite: single-agent Sales Manager view (no Alone/Vs, one agent only).
insert into public.app_ui_module (id, label, surface, kind, sort_order, description, active)
values (
  'sales_agent',
  'Sales Agent',
  'oversight',
  'suite',
  15,
  'Single-agent Sales Manager oversight — one agent window, no Alone/Vs toggle.',
  true
)
on conflict (id) do update set
  label = excluded.label,
  surface = excluded.surface,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  description = excluded.description,
  active = excluded.active;
