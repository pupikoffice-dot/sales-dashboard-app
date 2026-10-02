-- Managers could not see clients with no assigned_agent_id (common after ERP sync until
-- codes match user_profiles.agent_erp_id). Only super_admin/admin saw the full list.
-- Allow managers to SELECT every client whose company is in their allowed_companies.

drop policy if exists "clients_select" on clients;
create policy "clients_select" on clients
  for select to authenticated
  using (
    is_admin_or_above()
    or (
      exists (
        select 1 from user_profiles up
        where up.id = auth.uid()
          and up.role = 'manager'
      )
      and company in (
        select unnest(allowed_companies)
        from user_profiles
        where id = auth.uid()
      )
    )
    or (
      company in (
        select unnest(allowed_companies)
        from user_profiles
        where id = auth.uid()
      )
      and (
        assigned_agent_id = auth.uid()
        or assigned_agent_id in (select get_subtree_agent_ids(auth.uid()))
      )
    )
  );
