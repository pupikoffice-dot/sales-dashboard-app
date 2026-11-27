-- R&D sidebar now has a group tab "Import" (Order recommendation + Import stock cover). A user needs the group grant AND the page
-- grant, so every user who already has either page also gets the group grant (nobody loses a page they had).
update public.dashboard_user_access a
   set modules = a.modules || array['rnd_grp_import']
 where (a.modules && array['rnd_order_reco', 'rnd_import_cover'])
   and not ('rnd_grp_import' = any(a.modules));
