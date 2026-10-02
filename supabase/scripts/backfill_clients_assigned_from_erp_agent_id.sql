-- Backfill clients.assigned_agent_id from clients.erp_agent_id (acc101 column D).
-- Uses the same matching rules as trigger public.clients_assign_from_erp_agent:
--   active agent, role = agent, lower(trim(agent_erp_id)) = lower(trim(erp_agent_id)),
--   if several profiles share one code, earliest created_at wins.
--
-- Before running:
--   1) In Admin → Users (or Table Editor → user_profiles), set agent_erp_id for each
--      field agent to the exact ERP code from Excel (e.g. 24, 25, 27, 55 — same string
--      the sheet uses; if the sheet has leading zeros, match those).
--   2) Run in SQL Editor (postgres bypasses RLS).
--
-- Optional: restrict to certain client ERP codes only — see second query below.

-- ─── Full backfill (all clients with erp_agent_id that match some agent) ─────
update public.clients c
set assigned_agent_id = sub.agent_id
from (
  select distinct on (lower(trim(up.agent_erp_id)))
    lower(trim(up.agent_erp_id)) as norm_erp,
    up.id as agent_id
  from public.user_profiles up
  where up.active = true
    and up.role = 'agent'
    and up.agent_erp_id is not null
    and length(trim(up.agent_erp_id)) > 0
  order by lower(trim(up.agent_erp_id)), up.created_at asc
) sub
where c.erp_agent_id is not null
  and length(trim(c.erp_agent_id)) > 0
  and lower(trim(c.erp_agent_id)) = sub.norm_erp;

-- ─── Optional: only clients whose ERP agent column is 24, 25, 27, or 55 ────────
-- Uncomment and run instead of the block above if you only want those codes.
-- Adjust the IN list if your sheet uses '024' etc.
--
-- update public.clients c
-- set assigned_agent_id = sub.agent_id
-- from (
--   select distinct on (lower(trim(up.agent_erp_id)))
--     lower(trim(up.agent_erp_id)) as norm_erp,
--     up.id as agent_id
--   from public.user_profiles up
--   where up.active = true
--     and up.role = 'agent'
--     and up.agent_erp_id is not null
--     and length(trim(up.agent_erp_id)) > 0
--   order by lower(trim(up.agent_erp_id)), up.created_at asc
-- ) sub
-- where c.erp_agent_id is not null
--   and length(trim(c.erp_agent_id)) > 0
--   and lower(trim(c.erp_agent_id)) = sub.norm_erp
--   and lower(trim(c.erp_agent_id)) in ('24', '25', '27', '55');
