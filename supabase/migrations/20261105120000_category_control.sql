-- Category control (Part 1: flag, choose, list). Nothing here writes to the ERP.
--
-- Background: a blank category in NextERP (REP103 column I = item_catalog.tablet_cat) hides an item from the sales team.
--   * An item with NO stock that still has a category is FLAGGED; a person chooses per item: Remove (pending CLEAR action),
--     Leave (presale mark, expires when stock arrives) or Never flag (exempt mark).
--   * An item WITH stock, an empty category and a known last category (item_category_last) gets a pending RESTORE action
--     automatically (no human step); with no last category it stays on the existing "in stock, no category" report.
-- "In stock" = present in the WMS 000 stock (inventory) with qty > 0. The file's grand-total line is not an item.
--
-- Access: the tables are service-role only (RLS on, no policies, no grants). Users reach them through definer RPCs with the
-- same gates as the items index (signed in, date.items not hidden, own companies). Writing additionally needs the write
-- permission: super_admin, or a row in category_control_writers (managed in SQL). Approving a held batch: super_admin only.
-- Evaluation (category_control_evaluate) is service-role only and is called by the data-health-check edge function every run.

-- ---------------------------------------------------------------- tables
create table if not exists public.item_category_actions (
  id            bigserial primary key,
  company       text        not null,
  sku           text        not null,
  action        text        not null check (action in ('CLEAR', 'RESTORE')),
  from_category text,                                   -- category at decision time (CLEAR: the one to remove; undo target)
  to_category   text        not null default '',        -- CLEAR: empty; RESTORE: the category to set
  reason        text,
  origin        text        not null default 'auto' check (origin in ('auto', 'decision', 'undo')),
  created_at    timestamptz not null default now(),
  decided_by    uuid,
  decided_at    timestamptz,
  status        text        not null default 'pending' check (status in ('pending', 'done', 'failed', 'cancelled')),
  attempts      int         not null default 0,
  last_error    text,
  updated_at    timestamptz not null default now(),     -- last status change (robot or evaluation)
  batch_id      bigint
);
create unique index if not exists item_category_actions_one_pending
  on public.item_category_actions (company, sku) where status = 'pending';
create index if not exists item_category_actions_status_idx on public.item_category_actions (company, status, updated_at desc);

create table if not exists public.item_category_marks (
  id            bigserial primary key,
  company       text        not null,
  sku           text        not null,
  kind          text        not null check (kind in ('presale', 'exempt')),
  note          text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  cleared_at    timestamptz,
  cleared_by    uuid,
  cleared_reason text
);
create unique index if not exists item_category_marks_one_active
  on public.item_category_marks (company, sku, kind) where cleared_at is null;

-- Items waiting for a person's choice (materialised so the safety cap can hold them back).
create table if not exists public.item_category_flags (
  id              bigserial primary key,
  company         text        not null,
  sku             text        not null,
  flagged_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_reason text,        -- stock_arrived | category_empty | exempt | presale | decided_remove | decided_leave | decided_exempt
  resolved_by     uuid,
  batch_id        bigint
);
create unique index if not exists item_category_flags_one_open
  on public.item_category_flags (company, sku) where resolved_at is null;

-- Per item memory: consecutive zero-stock checks (one check = one new stock load, so two checks are >= one load apart)
-- and the last time the item was seen with stock (null = not seen since tracking began).
create table if not exists public.item_category_state (
  company       text        not null,
  sku           text        not null,
  zero_checks   int         not null default 0,
  checked_snapshot timestamptz,
  last_stock_at timestamptz,
  primary key (company, sku)
);

-- Per company: the stock/catalogue snapshot last evaluated and the sizes seen (sanity check against half-loaded files).
create table if not exists public.item_category_runs (
  company        text primary key,
  stock_snapshot timestamptz,
  stock_items    int,
  catalog_items  int,
  evaluated_at   timestamptz,
  last_status    text,
  last_result    jsonb
);

-- Safety cap: a run that would queue too many new flags/actions queues none and records a held batch the owner approves.
create table if not exists public.item_category_batches (
  id            bigserial primary key,
  company       text        not null,
  created_at    timestamptz not null default now(),
  status        text        not null default 'held' check (status in ('held', 'approved', 'released', 'dismissed')),
  new_flags     int         not null default 0,
  new_restores  int         not null default 0,
  threshold     int         not null default 0,
  catalog_items int         not null default 0,
  mailed_at     timestamptz,
  approved_by   uuid,
  approved_at   timestamptz,
  approve_note  text,
  released_at   timestamptz
);
create unique index if not exists item_category_batches_one_open
  on public.item_category_batches (company) where status in ('held', 'approved');

create table if not exists public.item_category_log (
  id       bigserial primary key,
  at       timestamptz not null default now(),
  company  text,
  sku      text,
  event    text not null,
  by_user  uuid,
  detail   jsonb
);
create index if not exists item_category_log_idx on public.item_category_log (company, sku, at desc);

create table if not exists public.category_control_writers (
  user_id  uuid primary key references public.user_profiles(id) on delete cascade,
  added_at timestamptz not null default now()
);

do $$
declare t text;
begin
  foreach t in array array['item_category_actions','item_category_marks','item_category_flags','item_category_state',
                           'item_category_runs','item_category_batches','item_category_log','category_control_writers']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;
do $$
declare sq text;
begin
  foreach sq in array array['item_category_actions_id_seq','item_category_marks_id_seq','item_category_flags_id_seq',
                            'item_category_batches_id_seq','item_category_log_id_seq']
  loop
    execute format('revoke all on sequence public.%I from public, anon, authenticated', sq);
  end loop;
end $$;

-- ---------------------------------------------------------------- evaluation (per company)
create or replace function public.category_control_eval_company(p_co text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
 set statement_timeout to '120s'
as $function$
declare
  v_snap      timestamptz;
  v_cat_max   timestamptz;
  v_prev      item_category_runs;
  v_bad       text;
  v_n_stock   int;
  v_n_cat     int;       -- catalogued items = items with a non-empty category in the latest 103 load (cap base)
  v_new_snap  boolean;
  v_thr       int;
  v_flag_c    int;
  v_rest_c    int;
  v_total     int;
  v_cancelled int := 0;
  v_expired   int := 0;
  v_resolved  int := 0;
  v_ins_flags int := 0;
  v_ins_rest  int := 0;
  v_batch     item_category_batches;
  v_status    text := 'ok';
  v_held      jsonb := null;
  v_zero_cat  int;
  v_to_decide int;
  v_rest_pend int;
  v_needs     int;
begin
  -- ---- freshness guards
  select max(synced_at) into v_snap from inventory where company = p_co;
  select max(synced_at) into v_cat_max from item_catalog where company = p_co;
  select string_agg(k || ': ' || coalesce(s.status, 'missing'), '; ') into v_bad
  from unnest(array['000' || p_co || '.xls', 'rows:000' || p_co || '.xls',
                    'item103' || p_co || '.xls', 'rows:item103' || p_co || '.xls']) k
  left join source_file_status s on s.check_key = k
  where coalesce(s.status, 'missing') <> 'green';
  if v_bad is not null then
    return jsonb_build_object('company', p_co, 'status', 'stale', 'reason', 'data health not green (' || v_bad || ')');
  end if;
  if v_snap is null or v_snap < now() - interval '8 hours' then
    return jsonb_build_object('company', p_co, 'status', 'stale', 'reason', 'stock (WMS 000) data older than 8 hours');
  end if;
  if v_cat_max is null or v_cat_max < now() - interval '30 hours' then
    return jsonb_build_object('company', p_co, 'status', 'stale', 'reason', 'item catalogue (103) data older than 30 hours');
  end if;
  if v_snap > now() - interval '2 minutes' or v_cat_max > now() - interval '2 minutes' then
    return jsonb_build_object('company', p_co, 'status', 'loading', 'reason', 'a file was loaded in the last 2 minutes');
  end if;

  -- ---- working sets
  drop table if exists cc_stock;
  drop table if exists cc_cat;
  drop table if exists cc_flag_cand;
  drop table if exists cc_rest_cand;
  create temp table cc_stock on commit drop as
    select sku, sum(qty_on_hand) as qty from inventory
    where company = p_co and btrim(sku) <> 'סך הכל' group by sku;
  create temp table cc_cat on commit drop as
    select c.sku, coalesce(max(btrim(c.tablet_cat)), '') as cat
    from item_catalog c
    where c.company = p_co and c.synced_at >= v_cat_max - interval '2 hours'
    group by c.sku;
  create index on cc_stock (sku);
  create index on cc_cat (sku);
  select count(*) into v_n_stock from cc_stock;
  select count(*) filter (where cat <> '') into v_n_cat from cc_cat;

  select * into v_prev from item_category_runs where company = p_co;
  if found then
    if coalesce(v_prev.stock_items, 0) > 20 and v_n_stock < 0.5 * v_prev.stock_items then
      return jsonb_build_object('company', p_co, 'status', 'stale',
        'reason', format('stock file looks incomplete (%s items now, %s last time)', v_n_stock, v_prev.stock_items));
    end if;
    if coalesce(v_prev.catalog_items, 0) > 20 and v_n_cat < 0.8 * v_prev.catalog_items then
      return jsonb_build_object('company', p_co, 'status', 'stale',
        'reason', format('103 catalogue looks incomplete (%s categorised items now, %s last time)', v_n_cat, v_prev.catalog_items));
    end if;
  end if;

  v_new_snap := v_prev.stock_snapshot is distinct from v_snap;

  -- ---- hysteresis: one check per new stock snapshot
  if v_new_snap then
    -- categorised and out of stock: one more consecutive zero check
    insert into item_category_state as t (company, sku, zero_checks, checked_snapshot)
    select p_co, c.sku, 1, v_snap
    from cc_cat c left join cc_stock s on s.sku = c.sku
    where c.cat <> '' and coalesce(s.qty, 0) <= 0
    on conflict (company, sku) do update
      set zero_checks = t.zero_checks + 1, checked_snapshot = excluded.checked_snapshot;
    -- categorised with stock: reset, remember when it was last seen with stock
    insert into item_category_state as t (company, sku, zero_checks, checked_snapshot, last_stock_at)
    select p_co, c.sku, 0, v_snap, v_snap
    from cc_cat c join cc_stock s on s.sku = c.sku
    where c.cat <> '' and s.qty > 0
    on conflict (company, sku) do update
      set zero_checks = 0, checked_snapshot = excluded.checked_snapshot, last_stock_at = excluded.last_stock_at;
    -- no category (or gone from the catalogue): nothing to count
    update item_category_state st set zero_checks = 0, checked_snapshot = v_snap
    where st.company = p_co and st.zero_checks <> 0
      and not exists (select 1 from cc_cat c where c.sku = st.sku and c.cat <> '');
    -- items that had stock but are not catalogued keep no state; stock seen on an uncategorised item still counts as last stock
    update item_category_state st set last_stock_at = v_snap
    from cc_stock s
    where st.company = p_co and st.sku = s.sku and s.qty > 0;
  end if;

  -- ---- presale marks expire when the item gets stock
  with x as (
    update item_category_marks m set cleared_at = now(), cleared_reason = 'stock_arrived'
    from cc_stock s
    where m.company = p_co and m.kind = 'presale' and m.cleared_at is null and s.sku = m.sku and s.qty > 0
    returning m.sku
  )
  insert into item_category_log (company, sku, event) select p_co, sku, 'presale_expired_stock_arrived' from x;
  get diagnostics v_expired = row_count;

  -- ---- open flags that no longer apply resolve themselves
  update item_category_flags f set resolved_at = now(),
    resolved_reason = case
      when coalesce((select qty from cc_stock s where s.sku = f.sku), 0) > 0 then 'stock_arrived'
      when coalesce((select cat from cc_cat c where c.sku = f.sku), '') = '' then 'category_empty'
      when exists (select 1 from item_category_marks m where m.company = p_co and m.sku = f.sku and m.kind = 'exempt' and m.cleared_at is null) then 'exempt'
      else 'presale' end
  where f.company = p_co and f.resolved_at is null
    and (coalesce((select qty from cc_stock s where s.sku = f.sku), 0) > 0
         or coalesce((select cat from cc_cat c where c.sku = f.sku), '') = ''
         or exists (select 1 from item_category_marks m where m.company = p_co and m.sku = f.sku and m.cleared_at is null));
  get diagnostics v_resolved = row_count;

  -- ---- pending actions that no longer apply are cancelled
  with x as (
    update item_category_actions a set status = 'cancelled', updated_at = now(),
      last_error = case
        when exists (select 1 from item_category_marks m where m.company = p_co and m.sku = a.sku and m.kind = 'exempt' and m.cleared_at is null) then 'cancelled: item is exempt'
        when a.action = 'CLEAR' and coalesce((select qty from cc_stock s where s.sku = a.sku), 0) > 0 then 'cancelled: stock arrived'
        when a.action = 'CLEAR' and coalesce((select cat from cc_cat c where c.sku = a.sku), '') = '' then 'cancelled: category already empty'
        when a.action = 'CLEAR' then 'cancelled: category changed in the ERP'
        when a.action = 'RESTORE' and coalesce((select cat from cc_cat c where c.sku = a.sku), '') <> '' then 'cancelled: category was set meanwhile'
        else 'cancelled: stock gone' end
    where a.company = p_co and a.status = 'pending'
      and (
        exists (select 1 from item_category_marks m where m.company = p_co and m.sku = a.sku and m.kind = 'exempt' and m.cleared_at is null)
        or (a.action = 'CLEAR' and (
              coalesce((select qty from cc_stock s where s.sku = a.sku), 0) > 0
              or coalesce((select cat from cc_cat c where c.sku = a.sku), '') = ''
              or (select cat from cc_cat c where c.sku = a.sku) is distinct from a.from_category))
        or (a.action = 'RESTORE' and (
              coalesce((select cat from cc_cat c where c.sku = a.sku), '') <> ''
              or (a.origin <> 'undo' and coalesce((select qty from cc_stock s where s.sku = a.sku), 0) <= 0)))
      )
    returning a.company, a.sku, a.id, a.last_error
  )
  insert into item_category_log (company, sku, event, detail)
  select company, sku, 'action_cancelled', jsonb_build_object('action_id', id, 'why', last_error) from x;
  get diagnostics v_cancelled = row_count;

  -- ---- candidates
  create temp table cc_flag_cand on commit drop as
    select c.sku
    from cc_cat c
    join item_category_state st on st.company = p_co and st.sku = c.sku and st.zero_checks >= 2
    left join cc_stock s on s.sku = c.sku
    where c.cat <> '' and coalesce(s.qty, 0) <= 0
      and not exists (select 1 from item_category_marks m where m.company = p_co and m.sku = c.sku and m.cleared_at is null)
      and not exists (select 1 from item_category_flags f where f.company = p_co and f.sku = c.sku and f.resolved_at is null)
      and not exists (select 1 from item_category_actions a where a.company = p_co and a.sku = c.sku
                      and (a.status = 'pending' or (a.status in ('done', 'failed') and a.updated_at > now() - interval '1 day')));
  create temp table cc_rest_cand on commit drop as
    select s.sku, h.last_category, case when c.sku is null then 'no_row' else 'empty' end as why
    from cc_stock s
    left join cc_cat c on c.sku = s.sku
    join item_category_last h on h.company = p_co and h.sku = s.sku
    where s.qty > 0 and coalesce(c.cat, '') = ''
      and not exists (select 1 from item_category_marks m where m.company = p_co and m.sku = s.sku and m.kind = 'exempt' and m.cleared_at is null)
      and not exists (select 1 from item_category_actions a where a.company = p_co and a.sku = s.sku
                      and (a.status = 'pending' or (a.status in ('done', 'failed') and a.updated_at > now() - interval '1 day')));
  select count(*) into v_flag_c from cc_flag_cand;
  select count(*) into v_rest_c from cc_rest_cand;
  v_total := v_flag_c + v_rest_c;
  v_thr := greatest(least(floor(v_n_cat * 0.05)::int, 300), 0);

  select count(*) into v_zero_cat
  from cc_cat c left join cc_stock s on s.sku = c.sku
  where c.cat <> '' and coalesce(s.qty, 0) <= 0
    and not exists (select 1 from item_category_marks m where m.company = p_co and m.sku = c.sku and m.cleared_at is null);

  -- ---- safety cap
  select * into v_batch from item_category_batches where company = p_co and status in ('held', 'approved');
  if found and v_batch.status = 'approved' then
    -- the owner approved: queue everything now, once
    update item_category_batches set status = 'released', released_at = now() where id = v_batch.id;
    insert into item_category_log (company, event, detail) values (p_co, 'batch_released',
      jsonb_build_object('batch', v_batch.id, 'flags', v_flag_c, 'restores', v_rest_c));
  elsif v_total > v_thr then
    if found then
      update item_category_batches set new_flags = v_flag_c, new_restores = v_rest_c, threshold = v_thr, catalog_items = v_n_cat
      where id = v_batch.id returning * into v_batch;
    else
      insert into item_category_batches (company, new_flags, new_restores, threshold, catalog_items)
      values (p_co, v_flag_c, v_rest_c, v_thr, v_n_cat) returning * into v_batch;
      insert into item_category_log (company, event, detail) values (p_co, 'batch_held',
        jsonb_build_object('batch', v_batch.id, 'flags', v_flag_c, 'restores', v_rest_c, 'threshold', v_thr));
    end if;
    v_status := 'held';
    v_held := jsonb_build_object('id', v_batch.id, 'newFlags', v_flag_c, 'newRestores', v_rest_c, 'threshold', v_thr,
                                 'catalogItems', v_n_cat, 'mailedAt', v_batch.mailed_at);
  elsif found then
    update item_category_batches set status = 'dismissed' where id = v_batch.id;  -- back under the cap: not needed any more
  end if;

  if v_status <> 'held' then
    insert into item_category_flags (company, sku, batch_id) select p_co, sku, v_batch.id from cc_flag_cand
    on conflict do nothing;
    get diagnostics v_ins_flags = row_count;
    insert into item_category_actions (company, sku, action, from_category, to_category, reason, origin, batch_id)
    select p_co, sku, 'RESTORE', null, last_category,
           'in stock, category empty' || case when why = 'no_row' then ' (not in the 103 export)' else '' end, 'auto', v_batch.id
    from cc_rest_cand
    on conflict do nothing;
    get diagnostics v_ins_rest = row_count;
    if v_ins_flags + v_ins_rest > 0 then
      insert into item_category_log (company, event, detail)
      values (p_co, 'queued', jsonb_build_object('flags', v_ins_flags, 'restores', v_ins_rest));
    end if;
  end if;

  select count(*) into v_to_decide from item_category_flags where company = p_co and resolved_at is null;
  select count(*) into v_rest_pend from item_category_actions where company = p_co and status = 'pending' and action = 'RESTORE';
  select count(*) into v_needs
  from cc_stock s left join cc_cat c on c.sku = s.sku
  where s.qty > 0 and coalesce(c.cat, '') = ''
    and not exists (select 1 from item_category_last h where h.company = p_co and h.sku = s.sku);

  insert into item_category_runs as r (company, stock_snapshot, stock_items, catalog_items, evaluated_at, last_status, last_result)
  values (p_co, v_snap, v_n_stock, v_n_cat, now(), v_status, null)
  on conflict (company) do update set stock_snapshot = excluded.stock_snapshot, stock_items = excluded.stock_items,
    catalog_items = excluded.catalog_items, evaluated_at = excluded.evaluated_at, last_status = excluded.last_status;

  drop table if exists cc_stock; drop table if exists cc_cat; drop table if exists cc_flag_cand; drop table if exists cc_rest_cand;

  return jsonb_build_object('company', p_co, 'status', v_status, 'newSnapshot', v_new_snap,
    'toDecide', v_to_decide, 'restorePending', v_rest_pend, 'needsCategory', v_needs,
    'newFlags', v_ins_flags, 'newRestores', v_ins_rest, 'cancelled', v_cancelled, 'flagsResolved', v_resolved,
    'presaleExpired', v_expired, 'catalogItems', v_n_cat, 'stockItems', v_n_stock,
    'capThreshold', v_thr, 'zeroStockWithCategory', v_zero_cat,
    'flagCandidates', v_flag_c, 'restoreCandidates', v_rest_c,
    'held', v_held);
end;
$function$;
revoke all on function public.category_control_eval_company(text) from public, anon, authenticated;

-- ---------------------------------------------------------------- evaluation (all companies, called by the edge function)
create or replace function public.category_control_evaluate(p_company text default null, p_dry_run boolean default false)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
 set statement_timeout to '300s'
as $function$
declare
  co  text;
  r   jsonb;
  out jsonb := '[]'::jsonb;
begin
  for co in
    select distinct company from source_file_status
    where file_group = 'wms' and company is not null and (p_company is null or company = p_company)
    order by 1
  loop
    begin
      r := category_control_eval_company(co);
      if p_dry_run then raise exception 'dry run' using errcode = 'CC001'; end if;   -- rolls this company's writes back, r survives
    exception when sqlstate 'CC001' then
      null;
    when others then
      r := jsonb_build_object('company', co, 'status', 'error', 'reason', sqlerrm);
    end;
    out := out || jsonb_build_array(r);
  end loop;
  return jsonb_build_object('dryRun', p_dry_run, 'companies', out,
    'heldUnmailed', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'company', company, 'newFlags', new_flags,
        'newRestores', new_restores, 'threshold', threshold, 'catalogItems', catalog_items) order by id)
      from item_category_batches where status = 'held' and mailed_at is null), '[]'::jsonb));
end;
$function$;
revoke all on function public.category_control_evaluate(text, boolean) from public, anon, authenticated;
grant execute on function public.category_control_evaluate(text, boolean) to service_role;

create or replace function public.category_control_mark_mailed(p_ids bigint[])
 returns void
 language sql
 security definer
 set search_path to 'public'
as $function$
  update item_category_batches set mailed_at = now() where id = any(p_ids) and mailed_at is null;
$function$;
revoke all on function public.category_control_mark_mailed(bigint[]) from public, anon, authenticated;
grant execute on function public.category_control_mark_mailed(bigint[]) to service_role;

-- Counts for the daily summary mail (service role).
create or replace function public.category_control_counts()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'toDecide',       (select count(*) from item_category_flags where resolved_at is null),
    'restorePending', (select count(*) from item_category_actions where status = 'pending' and action = 'RESTORE'),
    'clearPending',   (select count(*) from item_category_actions where status = 'pending' and action = 'CLEAR'),
    'held',           (select count(*) from item_category_batches where status = 'held'),
    'perCompany', coalesce((select jsonb_object_agg(company, jsonb_build_object(
        'toDecide', (select count(*) from item_category_flags f where f.company = x.company and f.resolved_at is null),
        'restorePending', (select count(*) from item_category_actions a where a.company = x.company and a.status = 'pending' and a.action = 'RESTORE')))
      from (select distinct company from item_category_runs) x), '{}'::jsonb));
$function$;
revoke all on function public.category_control_counts() from public, anon, authenticated;
grant execute on function public.category_control_counts() to service_role;

-- ---------------------------------------------------------------- user-facing RPCs
-- Shared gate. Returns the caller's access row, or null when the caller may not use the Items area.
create or replace function public.cc_gate()
 returns dashboard_user_access
 language plpgsql
 stable
 security definer
 set search_path to 'public'
as $function$
declare acc dashboard_user_access;
begin
  acc := get_dashboard_access(auth.uid());
  if acc.user_id is null or 'date.items' = any(coalesce(acc.hidden_sidebar, '{}')) then return null; end if;
  return acc;
end;
$function$;
revoke all on function public.cc_gate() from public, anon, authenticated;

create or replace function public.cc_can_write()
 returns boolean
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select auth.uid() is not null and (is_super_admin() or exists (select 1 from category_control_writers w where w.user_id = auth.uid()));
$function$;
revoke all on function public.cc_can_write() from public, anon, authenticated;

create or replace function public.get_category_control(p_company text default null)
 returns jsonb
 language plpgsql
 stable
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access;
  cos text[];
  can_write boolean;
begin
  acc := cc_gate();
  if acc.user_id is null then
    return jsonb_build_object('canWrite', false, 'canApprove', false, 'toDecide', '[]'::jsonb, 'restore', '[]'::jsonb,
      'pending', '[]'::jsonb, 'history', '[]'::jsonb, 'presale', '[]'::jsonb, 'exempt', '[]'::jsonb, 'held', '[]'::jsonb,
      'runs', '[]'::jsonb);
  end if;
  cos := array(select c from unnest(acc.companies) c where p_company is null or c = p_company);
  can_write := cc_can_write();

  return jsonb_build_object(
    'canWrite', can_write,
    'canApprove', is_super_admin(),
    'toDecide', coalesce((
      select jsonb_agg(jsonb_build_object('co', f.company, 'sku', f.sku, 'name', coalesce(nullif(p.name, ''), ''),
               'cat', nullif(btrim(c.tablet_cat), ''), 'flaggedAt', f.flagged_at, 'lastStockAt', st.last_stock_at,
               'wms', coalesce(s.qty, 0), 'lcat', h.last_category) order by f.company, f.flagged_at, f.sku)
      from item_category_flags f
      left join item_pricing p on p.company = f.company and p.sku = f.sku
      left join item_catalog c on c.company = f.company and c.sku = f.sku
        and c.synced_at = (select max(synced_at) from item_catalog c2 where c2.company = f.company and c2.sku = f.sku)
      left join item_category_state st on st.company = f.company and st.sku = f.sku
      left join item_category_last h on h.company = f.company and h.sku = f.sku
      left join (select company, sku, sum(qty_on_hand) qty from inventory where company = any(cos) group by 1, 2) s
             on s.company = f.company and s.sku = f.sku
      where f.resolved_at is null and f.company = any(cos)), '[]'::jsonb),
    'restore', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'co', a.company, 'sku', a.sku, 'name', coalesce(nullif(p.name, ''), ''),
               'to', a.to_category, 'reason', a.reason, 'createdAt', a.created_at, 'origin', a.origin,
               'wms', s.qty) order by a.company, a.sku)
      from item_category_actions a
      left join item_pricing p on p.company = a.company and p.sku = a.sku
      left join (select company, sku, sum(qty_on_hand) qty from inventory where company = any(cos) group by 1, 2) s
             on s.company = a.company and s.sku = a.sku
      where a.status = 'pending' and a.action = 'RESTORE' and a.company = any(cos)), '[]'::jsonb),
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object('id', a.id, 'co', a.company, 'sku', a.sku, 'name', coalesce(nullif(p.name, ''), ''),
               'action', a.action, 'from', a.from_category, 'to', a.to_category, 'reason', a.reason, 'origin', a.origin,
               'createdAt', a.created_at, 'decidedAt', a.decided_at, 'decidedBy', coalesce(u.name, u.email)) order by a.created_at desc, a.id desc)
      from item_category_actions a
      left join item_pricing p on p.company = a.company and p.sku = a.sku
      left join user_profiles u on u.id = a.decided_by
      where a.status = 'pending' and a.company = any(cos)), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(x.j order by x.ts desc) from (
        select a.updated_at ts, jsonb_build_object('id', a.id, 'co', a.company, 'sku', a.sku, 'name', coalesce(nullif(p.name, ''), ''),
               'action', a.action, 'from', a.from_category, 'to', a.to_category, 'status', a.status, 'error', a.last_error,
               'attempts', a.attempts, 'origin', a.origin, 'at', a.updated_at, 'decidedBy', coalesce(u.name, u.email)) j
        from item_category_actions a
        left join item_pricing p on p.company = a.company and p.sku = a.sku
        left join user_profiles u on u.id = a.decided_by
        where a.status <> 'pending' and a.company = any(cos)
        order by a.updated_at desc limit 300) x), '[]'::jsonb),
    'presale', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'co', m.company, 'sku', m.sku, 'name', coalesce(nullif(p.name, ''), ''),
               'note', m.note, 'createdAt', m.created_at, 'by', coalesce(u.name, u.email)) order by m.company, m.created_at desc)
      from item_category_marks m
      left join item_pricing p on p.company = m.company and p.sku = m.sku
      left join user_profiles u on u.id = m.created_by
      where m.kind = 'presale' and m.cleared_at is null and m.company = any(cos)), '[]'::jsonb),
    'exempt', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'co', m.company, 'sku', m.sku, 'name', coalesce(nullif(p.name, ''), ''),
               'note', m.note, 'createdAt', m.created_at, 'by', coalesce(u.name, u.email)) order by m.company, m.created_at desc)
      from item_category_marks m
      left join item_pricing p on p.company = m.company and p.sku = m.sku
      left join user_profiles u on u.id = m.created_by
      where m.kind = 'exempt' and m.cleared_at is null and m.company = any(cos)), '[]'::jsonb),
    'held', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'co', b.company, 'newFlags', b.new_flags, 'newRestores', b.new_restores,
               'threshold', b.threshold, 'catalogItems', b.catalog_items, 'status', b.status, 'createdAt', b.created_at) order by b.id)
      from item_category_batches b where b.status in ('held', 'approved') and b.company = any(cos)), '[]'::jsonb),
    'runs', coalesce((
      select jsonb_agg(jsonb_build_object('co', r.company, 'stockSnapshot', r.stock_snapshot, 'evaluatedAt', r.evaluated_at,
               'status', r.last_status) order by r.company)
      from item_category_runs r where r.company = any(cos)), '[]'::jsonb)
  );
end;
$function$;
revoke all on function public.get_category_control(text) from public, anon;
grant execute on function public.get_category_control(text) to authenticated;

-- Decide on flagged items. decision: remove | leave | exempt. Returns {done, skipped}.
create or replace function public.category_control_decide_bulk(p_company text, p_skus text[], p_decision text, p_note text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access;
  v_sku text;
  v_cat text;
  v_qty numeric;
  v_done int := 0;
  v_skip int := 0;
  v_ins int;
begin
  acc := cc_gate();
  if acc.user_id is null or not (p_company = any(acc.companies)) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not cc_can_write() then raise exception 'no permission to change categories' using errcode = '42501'; end if;
  if p_decision not in ('remove', 'leave', 'exempt') then raise exception 'bad decision %', p_decision; end if;
  if coalesce(array_length(p_skus, 1), 0) > 2000 then raise exception 'too many items'; end if;

  foreach v_sku in array p_skus loop
    -- must be an open flag (remove / leave) so a stale screen cannot act on an item that changed
    if p_decision <> 'exempt' and not exists (
         select 1 from item_category_flags where company = p_company and sku = v_sku and resolved_at is null) then
      v_skip := v_skip + 1; continue;
    end if;
    if p_decision = 'exempt' and not exists (select 1 from item_catalog where company = p_company and sku = v_sku) then
      v_skip := v_skip + 1; continue;
    end if;

    if p_decision = 'remove' then
      select nullif(btrim(c.tablet_cat), '') into v_cat from item_catalog c
        where c.company = p_company and c.sku = v_sku order by c.synced_at desc limit 1;
      select coalesce(sum(qty_on_hand), 0) into v_qty from inventory where company = p_company and sku = v_sku;
      if v_cat is null or v_qty > 0 then v_skip := v_skip + 1; continue; end if;   -- changed meanwhile: the next evaluation resolves the flag
      insert into item_category_actions (company, sku, action, from_category, to_category, reason, origin, decided_by, decided_at)
      values (p_company, v_sku, 'CLEAR', v_cat, '', 'no stock: category removal chosen', 'decision', auth.uid(), now())
      on conflict do nothing;
      get diagnostics v_ins = row_count;
      if v_ins = 0 then v_skip := v_skip + 1; continue; end if;
    elsif p_decision = 'leave' then
      insert into item_category_marks (company, sku, kind, note, created_by) values (p_company, v_sku, 'presale', p_note, auth.uid())
      on conflict do nothing;
    else
      insert into item_category_marks (company, sku, kind, note, created_by) values (p_company, v_sku, 'exempt', p_note, auth.uid())
      on conflict do nothing;
      update item_category_actions set status = 'cancelled', updated_at = now(), last_error = 'cancelled: item set to never flag'
        where company = p_company and sku = v_sku and status = 'pending';
    end if;
    update item_category_flags set resolved_at = now(), resolved_by = auth.uid(),
        resolved_reason = case p_decision when 'remove' then 'decided_remove' when 'leave' then 'decided_leave' else 'decided_exempt' end
      where company = p_company and sku = v_sku and resolved_at is null;
    insert into item_category_log (company, sku, event, by_user, detail)
      values (p_company, v_sku, 'decide_' || p_decision, auth.uid(), jsonb_build_object('note', p_note, 'category', v_cat));
    v_done := v_done + 1;
  end loop;
  return jsonb_build_object('done', v_done, 'skipped', v_skip);
end;
$function$;
revoke all on function public.category_control_decide_bulk(text, text[], text, text) from public, anon;
grant execute on function public.category_control_decide_bulk(text, text[], text, text) to authenticated;

create or replace function public.category_control_decide(p_company text, p_sku text, p_decision text, p_note text default null)
 returns jsonb
 language sql
 security definer
 set search_path to 'public'
as $function$
  select public.category_control_decide_bulk(p_company, array[p_sku], p_decision, p_note);
$function$;
revoke all on function public.category_control_decide(text, text, text, text) from public, anon;
grant execute on function public.category_control_decide(text, text, text, text) to authenticated;

-- Undo. p_what: 'presale' | 'exempt' (clears the mark; the next evaluation flags the item again if it still qualifies)
--               'action' (p_ref = action id: a pending action is cancelled; a done CLEAR queues a RESTORE of the stored category).
create or replace function public.category_control_undo(p_company text, p_sku text, p_what text, p_ref bigint default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
 set statement_timeout to '30s'
as $function$
declare
  acc dashboard_user_access;
  a item_category_actions;
  n int;
begin
  acc := cc_gate();
  if acc.user_id is null or not (p_company = any(acc.companies)) then raise exception 'not allowed' using errcode = '42501'; end if;
  if not cc_can_write() then raise exception 'no permission to change categories' using errcode = '42501'; end if;

  if p_what in ('presale', 'exempt') then
    update item_category_marks set cleared_at = now(), cleared_by = auth.uid(), cleared_reason = 'undo'
      where company = p_company and sku = p_sku and kind = p_what and cleared_at is null;
    get diagnostics n = row_count;
    insert into item_category_log (company, sku, event, by_user) values (p_company, p_sku, 'undo_' || p_what, auth.uid());
    return jsonb_build_object('done', n);
  elsif p_what = 'action' then
    select * into a from item_category_actions where id = p_ref and company = p_company and sku = p_sku;
    if not found then return jsonb_build_object('done', 0); end if;
    if a.status = 'pending' then
      update item_category_actions set status = 'cancelled', updated_at = now(), last_error = 'cancelled by user' where id = a.id;
    elsif a.status = 'done' and a.action = 'CLEAR' and a.from_category is not null then
      insert into item_category_actions (company, sku, action, from_category, to_category, reason, origin, decided_by, decided_at)
      values (p_company, p_sku, 'RESTORE', '', a.from_category, 'undo of removal #' || a.id, 'undo', auth.uid(), now())
      on conflict do nothing;
      get diagnostics n = row_count;
      if n = 0 then return jsonb_build_object('done', 0); end if;
    else
      return jsonb_build_object('done', 0);
    end if;
    insert into item_category_log (company, sku, event, by_user, detail)
      values (p_company, p_sku, 'undo_action', auth.uid(), jsonb_build_object('action_id', a.id, 'was', a.status));
    return jsonb_build_object('done', 1);
  end if;
  raise exception 'bad undo type %', p_what;
end;
$function$;
revoke all on function public.category_control_undo(text, text, text, bigint) from public, anon;
grant execute on function public.category_control_undo(text, text, text, bigint) to authenticated;

-- Approve a held batch (super admin). The next evaluation queues everything once.
create or replace function public.approve_held_batch(p_batch_id bigint, p_note text default null)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  acc dashboard_user_access;
  b item_category_batches;
begin
  acc := cc_gate();
  if acc.user_id is null or not is_super_admin() then raise exception 'not allowed' using errcode = '42501'; end if;
  select * into b from item_category_batches where id = p_batch_id for update;
  if not found or b.status <> 'held' or not (b.company = any(acc.companies)) then
    return jsonb_build_object('done', 0);
  end if;
  update item_category_batches set status = 'approved', approved_by = auth.uid(), approved_at = now(), approve_note = p_note
    where id = p_batch_id;
  insert into item_category_log (company, event, by_user, detail)
    values (b.company, 'batch_approved', auth.uid(), jsonb_build_object('batch', b.id, 'note', p_note));
  return jsonb_build_object('done', 1);
end;
$function$;
revoke all on function public.approve_held_batch(bigint, text) from public, anon;
grant execute on function public.approve_held_batch(bigint, text) to authenticated;
