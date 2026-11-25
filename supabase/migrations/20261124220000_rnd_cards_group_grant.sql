-- R&D sidebar now has a group tab "Cards" (Client card + Item card). A user needs the group grant AND the page grant, so every
-- user who already has either card page also gets the group grant (nobody loses a page they had).
update public.dashboard_user_access a
   set modules = a.modules || array['rnd_grp_cards']
 where (a.modules && array['rnd_client_card', 'rnd_item_card'])
   and not ('rnd_grp_cards' = any(a.modules));
