-- Per-class Oversight look (classic + suite boards). No row = today's layout.
-- Reads: own class, or any class if super admin (View-as). Writes: super admin only.

create table public.class_oversight_layout (
  class_id text primary key references public.app_class (id) on delete cascade,
  layout jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.class_oversight_layout enable row level security;

grant select, insert, update, delete on public.class_oversight_layout to authenticated;

create policy class_oversight_layout_select on public.class_oversight_layout
  for select to authenticated
  using (
    is_super_admin()
    or class_id in (
      select auc.class_id
      from public.app_user_class auc
      where auc.user_id = auth.uid()
    )
  );

create policy class_oversight_layout_insert on public.class_oversight_layout
  for insert to authenticated
  with check (is_super_admin());

create policy class_oversight_layout_update on public.class_oversight_layout
  for update to authenticated
  using (is_super_admin())
  with check (is_super_admin());

create policy class_oversight_layout_delete on public.class_oversight_layout
  for delete to authenticated
  using (is_super_admin());
