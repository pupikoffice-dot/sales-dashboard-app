-- Solid is a third look. The check must allow it or the header menu cannot save the choice.
alter table public.dashboard_user_prefs
  drop constraint dashboard_user_prefs_skin_check;

alter table public.dashboard_user_prefs
  add constraint dashboard_user_prefs_skin_check
  check (skin in ('classic', 'bento', 'solid'));
