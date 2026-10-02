-- ERP agent code on profiles: used to expose 720 open-delivery sales_lines (synthetic client_id, no clients row).

alter table user_profiles add column if not exists agent_erp_id text;

comment on column user_profiles.agent_erp_id is
  'ERP agent identifier as it appears on exports (720 delivery, sales). Must match sales_lines.agent_erp_id for open_delivery RLS.';

drop policy if exists "sales_select_agent" on sales_lines;
create policy "sales_select_agent" on sales_lines
  for select to authenticated
  using (
    is_admin_or_above()
    or (
      company in (select unnest(allowed_companies) from user_profiles where id = auth.uid())
      and (
        exists (
          select 1 from clients c
          where c.erp_client_id = sales_lines.client_id
            and c.company = sales_lines.company
            and c.assigned_agent_id = auth.uid()
        )
        or exists (
          select 1 from clients c
          where c.erp_client_id = sales_lines.client_id
            and c.company = sales_lines.company
            and c.assigned_agent_id in (select get_subtree_agent_ids(auth.uid()))
        )
        or (
          sales_lines.doc_type = 'open_delivery'
          and sales_lines.agent_erp_id is not null
          and (
            sales_lines.agent_erp_id = (select up.agent_erp_id from user_profiles up where up.id = auth.uid())
            or exists (
              select 1 from user_profiles up
              where up.id in (select get_subtree_agent_ids(auth.uid()))
                and up.agent_erp_id is not null
                and up.agent_erp_id = sales_lines.agent_erp_id
            )
          )
        )
      )
    )
  );
