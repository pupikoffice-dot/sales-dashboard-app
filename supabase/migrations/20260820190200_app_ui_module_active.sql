-- Plan/spec require active flag (list active modules in Classes admin).
alter table public.app_ui_module
  add column if not exists active boolean not null default true;
