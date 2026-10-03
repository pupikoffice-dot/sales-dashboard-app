-- Phase 2 backfill: mirror every existing dashboard_user_access row into
-- app_grant as USER-level grants (not classes -- classes are Phase 4).
--
-- Deliberately NOT using the naive "unnest(agents)" from the plan draft:
-- agents:[] (empty array) means ALL agents, identically to agents:NULL
-- (see filterRows / permissions.test.ts). unnest() on an empty array
-- produces zero rows, which would have silently blanked every such user's
-- agent scope to nothing. No live user hits this today (checked), but the
-- backfill must be correct for whoever's the first future exception.

insert into app_grant (user_id, kind, key, value, effect)
select user_id, 'scope', 'company', c, 'allow'
  from dashboard_user_access, unnest(companies) as c
on conflict do nothing;

-- Agent wildcard: NULL or empty array both mean "all agents".
insert into app_grant (user_id, kind, key, value, effect)
select user_id, 'scope', 'agent', null, 'allow'
  from dashboard_user_access
 where agents is null or array_length(agents, 1) is null
on conflict do nothing;

-- Agent allow-list: only when agents is a genuinely non-empty array.
insert into app_grant (user_id, kind, key, value, effect)
select user_id, 'scope', 'agent', a, 'allow'
  from dashboard_user_access, unnest(agents) as a
 where agents is not null and array_length(agents, 1) is not null
on conflict do nothing;

insert into app_grant (user_id, kind, key, value, effect)
select user_id, 'field', 'item_cost', null, 'allow'
  from dashboard_user_access where show_item_cost
on conflict do nothing;

insert into app_grant (user_id, kind, key, value, effect)
select user_id, 'field', 'client_profit', null, 'allow'
  from dashboard_user_access where show_client_profit
on conflict do nothing;

-- Page modules, mirrored as node grants keyed 'view.<module id>'. Not yet
-- consumed by anything (app_node/nav wiring is Phase 5) -- this just keeps
-- the grant table's picture of "what does this user currently have"
-- complete, so Phase 4/5 don't need a second backfill pass.
insert into app_grant (user_id, kind, key, value, effect)
select user_id, 'node', 'view.' || m, null, 'allow'
  from dashboard_user_access, unnest(modules) as m
on conflict do nothing;
