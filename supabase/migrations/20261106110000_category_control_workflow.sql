-- Category control workflow change (owner decisions 2026-11-06):
--  A) Human decisions skip the cap. FLAG-REMOVE items (no stock + category, 2 checks) are always created as open flags in the
--     'to decide' list, however many there are. The safety cap now applies ONLY to the automatic RESTORE actions; a held batch
--     contains restores only. Freshness / half-loaded-file guards are unchanged.
--  B) Whoever may write (cc_can_write(): super_admin, admin, listed writers) may also approve a held restore batch.
--  C) get_category_control also returns the supplier code ('sup') per to-decide item (for the filter in the interface).
-- Reconcile: batches held by the old rule that held flags only (no restores) are dismissed; others keep their restores and
-- have the flag count zeroed. The flags themselves are created by the next evaluation (zero-check state is kept).

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
  v_total := v_rest_c;   -- the cap applies to the automatic restores only; flags are human decisions and are never held
  v_thr := greatest(least(floor(v_n_cat * 0.05)::int, 300), 0);

  select count(*) into v_zero_cat
  from cc_cat c left join cc_stock s on s.sku = c.sku
  where c.cat <> '' and coalesce(s.qty, 0) <= 0
    and not exists (select 1 from item_category_marks m where m.company = p_co and m.sku = c.sku and m.cleared_at is null);

  -- ---- flags: always queued for a person to decide (never held, whatever their number)
  insert into item_category_flags (company, sku) select p_co, sku from cc_flag_cand on conflict do nothing;
  get diagnostics v_ins_flags = row_count;

  -- ---- safety cap (automatic RESTORE actions only)
  select * into v_batch from item_category_batches where company = p_co and status in ('held', 'approved');
  if found and v_batch.status = 'approved' then
    -- the owner approved: queue everything now, once
    update item_category_batches set status = 'released', released_at = now() where id = v_batch.id;   -- restores below
    insert into item_category_log (company, event, detail) values (p_co, 'batch_released',
      jsonb_build_object('batch', v_batch.id, 'restores', v_rest_c));
  elsif v_total > v_thr then
    if found then
      update item_category_batches set new_flags = 0, new_restores = v_rest_c, threshold = v_thr, catalog_items = v_n_cat
      where id = v_batch.id returning * into v_batch;
    else
      insert into item_category_batches (company, new_flags, new_restores, threshold, catalog_items)
      values (p_co, 0, v_rest_c, v_thr, v_n_cat) returning * into v_batch;
      insert into item_category_log (company, event, detail) values (p_co, 'batch_held',
        jsonb_build_object('batch', v_batch.id, 'restores', v_rest_c, 'threshold', v_thr));
    end if;
    v_status := 'held';
    v_held := jsonb_build_object('id', v_batch.id, 'newFlags', 0, 'newRestores', v_rest_c, 'threshold', v_thr,
                                 'catalogItems', v_n_cat, 'mailedAt', v_batch.mailed_at);
  elsif found then
    update item_category_batches set status = 'dismissed' where id = v_batch.id;  -- back under the cap: not needed any more
  end if;

  if v_status <> 'held' then
    insert into item_category_actions (company, sku, action, from_category, to_category, reason, origin, batch_id)
    select p_co, sku, 'RESTORE', null, last_category,
           'in stock, category empty' || case when why = 'no_row' then ' (not in the 103 export)' else '' end, 'auto', v_batch.id
    from cc_rest_cand
    on conflict do nothing;
    get diagnostics v_ins_rest = row_count;
  end if;
  if v_ins_flags + v_ins_rest > 0 then
    insert into item_category_log (company, event, detail)
    values (p_co, 'queued', jsonb_build_object('flags', v_ins_flags, 'restores', v_ins_rest));
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
    'canApprove', can_write,
    'toDecide', coalesce((
      select jsonb_agg(jsonb_build_object('co', f.company, 'sku', f.sku, 'name', coalesce(nullif(p.name, ''), ''),
               'cat', nullif(btrim(c.tablet_cat), ''), 'flaggedAt', f.flagged_at, 'lastStockAt', st.last_stock_at,
               'wms', coalesce(s.qty, 0), 'lcat', h.last_category, 'sup', nullif(btrim(p.supplier_id), '')) order by f.company, f.flagged_at, f.sku)
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

-- Approve a held restore batch (super admin, admin, or a listed writer: cc_can_write()). The next evaluation queues everything once.
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
  if acc.user_id is null or not cc_can_write() then raise exception 'not allowed' using errcode = '42501'; end if;
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

-- ---------------------------------------------------------------- reconcile existing state
insert into public.item_category_log (company, event, detail)
  select company, 'batch_reconciled', jsonb_build_object('batch', id, 'was_flags', new_flags, 'rule', 'flags are no longer held')
  from public.item_category_batches where status = 'held' and new_restores = 0;
update public.item_category_batches set status = 'dismissed' where status = 'held' and new_restores = 0;
update public.item_category_batches set new_flags = 0 where status in ('held', 'approved') and new_flags <> 0;
