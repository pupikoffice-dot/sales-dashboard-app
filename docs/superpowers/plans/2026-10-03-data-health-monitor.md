# Data Health Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every file the dashboard loads is checked against a freshness rule; red files and sync failures produce email (Resend) and a history visible on `/admin/data-health`.

**Architecture:** The sync records one observation per file per run into Supabase. An edge function (`data-health-check`), triggered every 30 min by `pg_cron`, evaluates rules in pure TypeScript, writes current status, opens/closes incidents and sends email. The web app reads status/incidents directly (super-admin RLS). BETA first, production last.

**Tech Stack:** Python 3.14 sync (pytest), Supabase Postgres (migrations, RLS, pg_cron, pg_net, vault), Supabase Edge Functions (Deno), Resend HTTP API, React 19 + react-query + vitest.

**Spec:** `docs/superpowers/specs/2026-10-03-data-health-monitor-design.md`

---

## Conventions for this plan

- Repo: `C:\dev\sales-dashboard-app` (branch `beta`). Sync code: `\\srv\office\Biz-Dev\Projects\Codding\Management Dashboard\beta\sync\` (NOT in git; never edit `...\Management Dashboard\sync\` — that is OMEGA-stable, changed only by Promote/Apply).
- BETA project id `qwtfsnkabvbxurwduvyn`; production (OMEGA) `hzgpkkbqhmtwqhkcntcc`. Apply SQL with the Supabase MCP `apply_migration` (same name as the file without the timestamp).
- Run JS tests: `npx vitest run <path>` in the repo. Run Python tests: `py -3 -m pytest <path> -q` from the `beta\sync` folder.
- Spec deviations (deliberate, simpler): the page reads tables directly under RLS instead of read RPCs (only acknowledge is an RPC); current statuses are stored in a `source_file_status` table written by the checker so evaluation logic exists only once; the checker gates on local time itself (cron runs every 30 min all week) so it is correct across daylight-saving changes.

## File structure

| File | Responsibility |
|---|---|
| `supabase/migrations/20261003130000_data_health_tables.sql` | tables, indexes, RLS, `data_health_ack` RPC, `data_health_latest()` input function |
| `supabase/migrations/20261003130100_data_health_seed.sql` | file rules, settings row, acknowledged go-live incidents |
| `supabase/migrations/20261003130200_data_health_cron.sql` | pg_cron + pg_net, 30-min schedule reading URL/key from vault |
| `...\beta\sync\source_observations.py` | pure: collect per-file rows + build observation rows (no import side effects) |
| `...\beta\sync\tests\test_source_observations.py` | pytest for the above |
| `...\beta\sync\sync_to_supabase.py` | record rows per file; write observations at end of run |
| `supabase/functions/data-health-check/evaluate.ts` | pure: rules + observations + sync logs + now → statuses |
| `supabase/functions/data-health-check/incidents.ts` | pure: statuses + open incidents → open/close/remind actions |
| `supabase/functions/data-health-check/emails.ts` | pure: compose alert / reminder / resolved / summary emails |
| `supabase/functions/data-health-check/index.ts` | I/O: load, evaluate, write, send, retention |
| `src/lib/dataHealth/evaluate.test.ts`, `incidents.test.ts`, `emails.test.ts` | vitest for the pure function files |
| `src/lib/dataHealth/timeline.ts` (+ `.test.ts`) | pure: incidents → timeline segments, monthly stats |
| `src/lib/dataHealth/api.ts` | Supabase reads + acknowledge RPC |
| `src/hooks/useDataHealth.ts` | react-query hooks |
| `src/pages/admin/DataHealthPage.tsx` | the page |
| `src/App.tsx`, `src/pages/DashboardLayout.tsx` | route + nav link (super-admin) |

---

### Task 1: Tables, RLS and input function

**Files:**
- Create: `supabase/migrations/20261003130000_data_health_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Data health monitor: rules, per-run file observations, current status, incidents, settings.
create table if not exists public.source_files (
  file_name     text primary key,          -- as on disk; tsomet files use 'tsomet/budget.xlsx', 'tsomet/sales.xlsx'
  company       text,
  file_group    text not null,             -- p1 | rep722 | wms | nightly_aski | manual_sales | manual_ref | manual_clients | debt | tsomet | known_broken | frozen
  producer      text not null,
  fix_hint      text not null,
  impact        text not null,
  rule_kind     text not null check (rule_kind in ('age', 'nightly', 'frozen')),
  max_age_hours numeric,
  eval_from     time,                      -- local Asia/Jerusalem; null = whenever the checker runs
  eval_to       time,
  active        boolean not null default true
);

create table if not exists public.source_file_observations (
  id           bigint generated always as identity primary key,
  observed_at  timestamptz not null default now(),
  sync_log_id  uuid,
  host         text,
  file_name    text not null,
  modified_at  timestamptz,
  size_bytes   bigint,
  rows_loaded  integer,                     -- null = not loaded in this run
  processed    boolean not null default false
);
create index if not exists source_file_observations_file_time
  on public.source_file_observations (file_name, observed_at desc);

create table if not exists public.source_file_status (
  check_key    text primary key,            -- file name, 'rows:<file>', 'sync:no_success', 'sync:stuck'
  file_name    text,
  file_group   text not null,
  company      text,
  status       text not null check (status in ('green', 'amber', 'red', 'grey')),
  reason       text not null,
  modified_at  timestamptz,
  age_hours    numeric,
  rows_loaded  integer,
  evaluated_at timestamptz not null default now()
);

create table if not exists public.data_health_incidents (
  id               bigint generated always as identity primary key,
  check_key        text not null,
  opened_at        timestamptz not null default now(),
  closed_at        timestamptz,
  severity         text not null default 'red',
  reason           text not null,
  acknowledged_at  timestamptz,
  last_notified_at timestamptz,
  notes            text
);
create unique index if not exists data_health_incidents_one_open
  on public.data_health_incidents (check_key) where closed_at is null;

create table if not exists public.data_health_settings (
  id                boolean primary key default true check (id),
  recipients        text[] not null default '{}',
  from_address      text not null default 'onboarding@resend.dev',
  summary_time      time not null default '07:30',
  enabled           boolean not null default true,
  last_summary_date date
);

alter table public.source_files             enable row level security;
alter table public.source_file_observations enable row level security;
alter table public.source_file_status       enable row level security;
alter table public.data_health_incidents    enable row level security;
alter table public.data_health_settings     enable row level security;

create policy source_files_read     on public.source_files             for select to authenticated using (public.is_super_admin());
create policy source_file_obs_read  on public.source_file_observations for select to authenticated using (public.is_super_admin());
create policy source_file_stat_read on public.source_file_status       for select to authenticated using (public.is_super_admin());
create policy dh_incidents_read     on public.data_health_incidents    for select to authenticated using (public.is_super_admin());
create policy dh_settings_read      on public.data_health_settings     for select to authenticated using (public.is_super_admin());
-- Writes: service role only (sync + edge function bypass RLS); acknowledge goes through the RPC below.

create or replace function public.data_health_ack(p_incident_id bigint, p_notes text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_super_admin() then
    raise exception 'not allowed';
  end if;
  update public.data_health_incidents
     set acknowledged_at = coalesce(acknowledged_at, now()),
         notes = coalesce(p_notes, notes)
   where id = p_incident_id;
end $$;
revoke all on function public.data_health_ack(bigint, text) from public;
grant execute on function public.data_health_ack(bigint, text) to authenticated;

-- Checker input: latest observation per file + rows_loaded of up to 10 earlier processed runs (newest first).
create or replace function public.data_health_latest()
returns table (file_name text, observed_at timestamptz, modified_at timestamptz,
               rows_loaded integer, processed boolean, history integer[])
language sql stable set search_path = public as $$
  with ranked as (
    select o.*, row_number() over (partition by o.file_name order by o.observed_at desc) rn
    from public.source_file_observations o
    where o.observed_at > now() - interval '30 days'
  )
  select l.file_name, l.observed_at, l.modified_at, l.rows_loaded, l.processed,
         coalesce((select array_agg(h.rows_loaded order by h.observed_at desc)
                   from ranked h
                   where h.file_name = l.file_name and h.rn between 2 and 11
                     and h.processed and h.rows_loaded is not null), '{}')
  from ranked l
  where l.rn = 1;
$$;
revoke all on function public.data_health_latest() from public, anon, authenticated;
grant execute on function public.data_health_latest() to service_role;
```

- [ ] **Step 2: Apply to BETA**

MCP `apply_migration`, project `qwtfsnkabvbxurwduvyn`, name `data_health_tables`, query = file content.
Expected: `{"success":true}`.

- [ ] **Step 3: Verify**

MCP `execute_sql` on BETA:
```sql
select table_name from information_schema.tables where table_schema='public'
 and table_name in ('source_files','source_file_observations','source_file_status','data_health_incidents','data_health_settings') order by 1;
select * from public.data_health_latest();
```
Expected: 5 table names; empty function result.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261003130000_data_health_tables.sql
git commit -m "Add data health monitor tables, RLS and checker input function"
```

---

### Task 2: Seed rules, settings and go-live incidents

**Files:**
- Create: `supabase/migrations/20261003130100_data_health_seed.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Rules from the spec (section 1). Hours: 7 d = 168, 14 d = 336, 30 d = 720.
insert into public.source_files (file_name, company, file_group, producer, fix_hint, impact, rule_kind, max_age_hours, eval_from, eval_to) values
-- p1: smartpupik P1, every 90 min 08:00-20:00; red after 4 h, checked 10:00-21:00
('720pupik.xls','pupik','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','open deliveries','age',4,'10:00','21:00'),
('720mt.xls','mt','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','open deliveries','age',4,'10:00','21:00'),
('720gold.xls','gold','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','open deliveries','age',4,'10:00','21:00'),
('721pupik.xls','pupik','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','open orders','age',4,'10:00','21:00'),
('721mt.xls','mt','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','open orders','age',4,'10:00','21:00'),
('721gold.xls','gold','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','open orders','age',4,'10:00','21:00'),
('rep891pupik.xls','pupik','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','sales (current year)','age',4,'10:00','21:00'),
('rep891mt.xls','mt','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','sales (current year)','age',4,'10:00','21:00'),
('rep891gold.xls','gold','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','sales (current year)','age',4,'10:00','21:00'),
('collectyear008pupik.xls','pupik','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','receipts','age',4,'10:00','21:00'),
('collectyear008mt.xls','mt','p1','smartpupik P1','smartpupik Task app: run "Sales Dash P1 - Data"; check logs\erp_sequential.log','receipts','age',4,'10:00','21:00'),
-- rep722: hourly 09:00-18:00; red after 3 h, checked 11:00-19:00
('722pupik.xls','pupik','rep722','smartpupik Rep722','smartpupik Task app: run "Run Rep722 all"','orders today / MTD','age',3,'11:00','19:00'),
('722mt.xls','mt','rep722','smartpupik Rep722','smartpupik Task app: run "Run Rep722 all"','orders today / MTD','age',3,'11:00','19:00'),
-- wms: copy only when source changes; red after 30 h
('000pupik.xls','pupik','wms','smartpupik Copy WMS','smartpupik Task app: run "Copy WMS pupik and MT"; check the source in Sales Lists\DATA','stock','age',30,null,null),
('000mt.xls','mt','wms','smartpupik Copy WMS','smartpupik Task app: run "Copy WMS pupik and MT"; check the source in Sales Lists\DATA','stock','age',30,null,null),
-- nightly_aski: written by ERP user aski ~03:36; must be modified today, checked from 04:30
('rep893pupik.xls','pupik','nightly_aski','ERP user aski nightly batch','Not our job: ask the owner of the aski nightly batch; manual: \\srv\findat\batch\REP893.BAT','operations deliveries','nightly',null,'04:30',null),
('rep893mt.xls','mt','nightly_aski','ERP user aski nightly batch','Not our job: ask the owner of the aski nightly batch; manual: \\srv\findat\batch\REP893.BAT','operations deliveries','nightly',null,'04:30',null),
-- manual_sales: 7 days
('854PUP.xls','pupik','manual_sales','manual','Run \\srv\findat\batch\REP855&854ALL.BAT','sales lines (854)','age',168,null,null),
('854MT.xls','mt','manual_sales','manual','Run \\srv\findat\batch\REP855&854ALL.BAT','sales lines (854)','age',168,null,null),
('854grow.xls','grow','manual_sales','manual','Run \\srv\findat\batch\REP855&854ALL.BAT','sales lines (854)','age',168,null,null),
('855PUP.xls','pupik','manual_sales','manual','Run \\srv\findat\batch\REP855&854ALL.BAT','returns MTD','age',168,null,null),
('855MT.xls','mt','manual_sales','manual','Run \\srv\findat\batch\REP855&854ALL.BAT','returns MTD','age',168,null,null),
('887pupik.xls','pupik','manual_sales','manual (main PC)','Main PC Task app: run "BDS organizational Examine all"','sales lines (887)','age',168,null,null),
('887gold.xls','gold','manual_sales','manual (main PC)','Main PC Task app: run "BDS organizational Examine all"','sales lines (887)','age',168,null,null),
('888pupik.xls','pupik','manual_sales','manual (main PC)','Main PC Task app: run "BDS organizational Examine all"','sales lines (888)','age',168,null,null),
('888mt.xls','mt','manual_sales','manual (main PC)','Main PC Task app: run "BDS organizational Examine all"','sales lines (888)','age',168,null,null),
('888gold.xls','gold','manual_sales','manual (main PC)','Main PC Task app: run "BDS organizational Examine all"','sales lines (888)','age',168,null,null),
-- manual_ref: 14 days
('REP907pupik.xls','pupik','manual_ref','manual','Run the REP907 price report','prices / cost','age',336,null,null),
('REP907mt.xls','mt','manual_ref','manual','Run the REP907 price report','prices / cost','age',336,null,null),
('REP907grow.xls','grow','manual_ref','manual','Run the REP907 price report','prices / cost','age',336,null,null),
('REP907gold.xls','gold','manual_ref','manual','Run the REP907 price report','prices / cost','age',336,null,null),
('item103mt.xls','mt','manual_ref','manual','Run the item103 category report','item categories','age',336,null,null),
('item103grow.xls','grow','manual_ref','manual','Run the item103 category report','item categories','age',336,null,null),
-- manual_clients: 30 days, owner unknown
('acc101pupik.xls','pupik','manual_clients','unknown (to identify)','Owner unknown: find who runs acc101','client list / agents','age',720,null,null),
('acc101mt.xls','mt','manual_clients','unknown (to identify)','Owner unknown: find who runs acc101','client list / agents','age',720,null,null),
('acc101grow.xls','grow','manual_clients','unknown (to identify)','Owner unknown: find who runs acc101','client list / agents','age',720,null,null),
('acc101gold.xls','gold','manual_clients','unknown (to identify)','Owner unknown: find who runs acc101','client list / agents','age',720,null,null),
-- debt + tsomet: 7 days
('Debt clients.xlsm',null,'debt','user workbook + main PC "Copy debt clients file"','Update Debt clients.xlsm on the main PC; Task app "Copy debt clients file" copies it to Data','debt figures','age',168,null,null),
('tsomet/budget.xlsx','mt','tsomet','main PC segment report','Main PC Task app: run "Segment sales report (tsomet)"','Tsomet cube (MT)','age',168,null,null),
('tsomet/sales.xlsx','mt','tsomet','main PC segment report','Main PC Task app: run "Segment sales report (tsomet)"','Tsomet cube (MT)','age',168,null,null),
-- known_broken: 2 days, incidents pre-acknowledged below
('721grow.xls','grow','known_broken','none running (grow exports stopped)','Investigate the grow ERP export','grow open orders','age',48,null,null),
('rep891grow.xls','grow','known_broken','none running (grow exports stopped)','Investigate the grow ERP export','grow sales','age',48,null,null),
('collectyear008grow.xls','grow','known_broken','none running (grow exports stopped)','Investigate the grow ERP export','grow receipts','age',48,null,null),
('722gold.xls','gold','known_broken','none running since 2026-08-28','Find which job should export 722gold','gold orders','age',48,null,null),
-- frozen
('rep891pupik2025.xls','pupik','frozen','historical','-','sales 2025','frozen',null,null,null),
('rep891mt2025.xls','mt','frozen','historical','-','sales 2025','frozen',null,null,null),
('rep891grow2025.xls','grow','frozen','historical','-','sales 2025','frozen',null,null,null),
('collectyear008pupik 2024.xls','pupik','frozen','historical','-','receipts 2024','frozen',null,null,null),
('collectyear008mt 2024.xls','mt','frozen','historical','-','receipts 2024','frozen',null,null,null),
('collectyear008grow 2024.xls','grow','frozen','historical','-','receipts 2024','frozen',null,null,null),
('salesagentstargets26.xlsx',null,'frozen','yearly (manual)','-','agent targets','frozen',null,null,null)
on conflict (file_name) do nothing;

insert into public.data_health_settings (id, recipients, from_address)
values (true, array['pupikoffice@gmail.com'], 'onboarding@resend.dev')
on conflict (id) do nothing;

-- Known at go-live: open + acknowledged, so they show red without emails.
insert into public.data_health_incidents (check_key, reason, acknowledged_at, notes)
select f, 'known at go-live (2026-10-03)', now(), 'pre-acknowledged at go-live'
from unnest(array['721grow.xls','rep891grow.xls','collectyear008grow.xls','722gold.xls',
                  'acc101mt.xls','acc101grow.xls','acc101gold.xls']) f
where not exists (select 1 from public.data_health_incidents i where i.check_key = f and i.closed_at is null);
```

- [ ] **Step 2: Apply to BETA** — MCP `apply_migration`, BETA, name `data_health_seed`. Expected success.

- [ ] **Step 3: Verify**

```sql
select file_group, count(*) from public.source_files group by 1 order by 1;
select recipients, from_address from public.data_health_settings;
select count(*) from public.data_health_incidents where closed_at is null and acknowledged_at is not null;
```
Expected groups: debt 1, frozen 7, known_broken 4, manual_clients 4, manual_ref 6, manual_sales 10, nightly_aski 2, p1 11, rep722 2, tsomet 2, wms 2 (51 rules); recipients `{pupikoffice@gmail.com}`; 7 incidents.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261003130100_data_health_seed.sql
git commit -m "Seed data health rules, settings and go-live incidents"
```

---

### Task 3: Sync observation recorder (Python, TDD)

**Files:**
- Create: `\\srv\office\Biz-Dev\Projects\Codding\Management Dashboard\beta\sync\source_observations.py`
- Test: `\\srv\office\Biz-Dev\Projects\Codding\Management Dashboard\beta\sync\tests\test_source_observations.py`

- [ ] **Step 1: Write the failing tests**

```python
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from source_observations import Recorder, build_observations  # noqa: E402


def test_record_sums_per_file():
    r = Recorder()
    r.record('a.xls', 10)
    r.record('a.xls', 5)
    r.record('b.xls', 0)
    assert r.rows == {'a.xls': 15, 'b.xls': 0}


def test_build_lists_excel_files_with_rows_and_processed(tmp_path):
    (tmp_path / '722mt.xls').write_bytes(b'x' * 7)
    (tmp_path / 'Debtmt.xls').write_bytes(b'y')
    (tmp_path / 'Debt clients.xlsm').write_bytes(b'z')
    (tmp_path / 'notes.txt').write_text('ignore')
    (tmp_path / '~$722mt.xls').write_bytes(b'lock')
    obs = build_observations(str(tmp_path), {'722mt.xls': 38610, 'Debt clients.xlsm': 473}, {}, 'log-1', 'HOST')
    by = {o['file_name']: o for o in obs}
    assert set(by) == {'722mt.xls', 'Debtmt.xls', 'Debt clients.xlsm'}
    assert by['722mt.xls']['rows_loaded'] == 38610 and by['722mt.xls']['processed'] is True
    assert by['722mt.xls']['size_bytes'] == 7 and by['722mt.xls']['modified_at']
    assert by['Debtmt.xls']['rows_loaded'] is None and by['Debtmt.xls']['processed'] is False
    assert by['722mt.xls']['sync_log_id'] == 'log-1' and by['722mt.xls']['host'] == 'HOST'


def test_build_includes_extra_files_and_handles_missing(tmp_path):
    budget = tmp_path / 'budget.xlsx'
    budget.write_bytes(b'b')
    extra = {'tsomet/budget.xlsx': str(budget), 'tsomet/sales.xlsx': str(tmp_path / 'missing.xlsx')}
    obs = build_observations(str(tmp_path / 'nodir'), {'tsomet/budget.xlsx': 75}, extra, 'l', 'H')
    by = {o['file_name']: o for o in obs}
    assert by['tsomet/budget.xlsx']['rows_loaded'] == 75 and by['tsomet/budget.xlsx']['modified_at']
    assert by['tsomet/sales.xlsx']['modified_at'] is None and by['tsomet/sales.xlsx']['size_bytes'] is None


def test_build_only_names_filter(tmp_path):
    for n in ('722mt.xls', '722pupik.xls', '720mt.xls'):
        (tmp_path / n).write_bytes(b'1')
    obs = build_observations(str(tmp_path), {}, {}, 'l', 'H', only_names={'722mt.xls', '722pupik.xls'})
    assert sorted(o['file_name'] for o in obs) == ['722mt.xls', '722pupik.xls']
```

- [ ] **Step 2: Run to verify failure**

Run (in `beta\sync`): `py -3 -m pytest tests/test_source_observations.py -q`
Expected: FAIL — `ModuleNotFoundError: No module named 'source_observations'`.

- [ ] **Step 3: Implement**

```python
"""Per-file observations for the data health monitor.

No side effects at import time (sync_to_supabase.py connects to Supabase on import; this
module must stay testable without it). The sync calls Recorder.record() with the rows it
loaded from each file, then build_observations() at the end of the run.
"""
import os
from datetime import datetime, timezone

EXTENSIONS = ('.xls', '.xlsx', '.xlsm')


class Recorder:
    def __init__(self):
        self.rows: dict[str, int] = {}

    def record(self, file_name: str, rows) -> None:
        self.rows[file_name] = self.rows.get(file_name, 0) + int(rows or 0)


def _stat(path: str):
    st = os.stat(path)
    return datetime.fromtimestamp(st.st_mtime, timezone.utc).isoformat(), st.st_size


def build_observations(data_dir: str, recorded: dict, extra_files: dict, sync_log_id, host: str,
                       only_names: set | None = None) -> list[dict]:
    names: list[str] = []
    if os.path.isdir(data_dir):
        names = sorted(
            n for n in os.listdir(data_dir)
            if n.lower().endswith(EXTENSIONS) and not n.startswith('~$')
            and os.path.isfile(os.path.join(data_dir, n))
        )
    targets = [(n, os.path.join(data_dir, n)) for n in names] + list(extra_files.items())
    now = datetime.now(timezone.utc).isoformat()
    out = []
    for name, path in targets:
        if only_names is not None and name not in only_names:
            continue
        try:
            modified, size = _stat(path)
        except OSError:
            modified, size = None, None
        rows = recorded.get(name)
        out.append({
            'observed_at': now, 'sync_log_id': sync_log_id, 'host': host, 'file_name': name,
            'modified_at': modified, 'size_bytes': size, 'rows_loaded': rows,
            'processed': rows is not None,
        })
    return out
```

- [ ] **Step 4: Run to verify pass** — same command. Expected: `4 passed`.

- [ ] **Step 5: No git commit** — sync code is not in git; `beta\sync` is versioned by the release process (Promote snapshots it into `releases\vNNN`).

---

### Task 4: Wire the recorder into the BETA sync

**Files:**
- Modify: `\\srv\office\Biz-Dev\Projects\Codding\Management Dashboard\beta\sync\sync_to_supabase.py`

- [ ] **Step 1: Imports and globals** — next to the other local imports (after `from excel_parser import ...`), add:

```python
import socket
from source_observations import Recorder, build_observations

_OBS = Recorder()
TSOMET_FILES = {
    'tsomet/budget.xlsx': os.environ.get('TSOMET_BUDGET_XLSX', r'\\srv\office\Biz-Dev\Reports\tsomet\budget.xlsx'),
    'tsomet/sales.xlsx': os.environ.get('TSOMET_SALES_XLSX', r'\\srv\office\Biz-Dev\Reports\tsomet\Segment reports DATA\sales.xlsx'),
}


def _write_observations(log_id: str, only_names: set | None = None) -> None:
    """Data health monitor input. Never fails the sync."""
    try:
        rows = build_observations(ERP_DATA_DIR, _OBS.rows, {} if only_names else TSOMET_FILES,
                                  log_id, socket.gethostname(), only_names)
        for i in range(0, len(rows), 500):
            supabase.table('source_file_observations').insert(rows[i:i + 500]).execute()
        print(f'  Observations: {len(rows)} files recorded')
    except Exception as e:
        print(f'  Observations failed (non-fatal): {e}')
```

- [ ] **Step 2: Record rows per file**
  - Main loop, directly after `print(f"    Upserted {count} rows")`: add `_OBS.record(filename, count)`.
  - `_sync_rep893`: after `print(f'  rep893 {company}: loaded {len(rows)} rows')` add `_OBS.record(fname, len(rows))`; in the `if not rows:` branch before `continue` add `_OBS.record(fname, 0)`.
  - `_sync_receipts`: after the `loaded {len(rows)} rows` print add `_OBS.record(fname, len(rows))`; in its `if not rows:` branch add `_OBS.record(fname, 0)`.
  - `_sync_debts_from_clients_xlsm`: after the `loaded {count} rows from '{tab}' tab` print add `_OBS.record(os.path.basename(DEBT_CLIENTS_XLSM), count)`; in the `if not rows:` branch add `_OBS.record(os.path.basename(DEBT_CLIENTS_XLSM), 0)`.
  - Tsomet block: replace `sync_tsomet(supabase=supabase)` with
    ```python
                res = sync_tsomet(supabase=supabase)
                if res.get('success') and not res.get('skipped'):
                    _OBS.record('tsomet/budget.xlsx', res.get('budget_rows', 0))
                    _OBS.record('tsomet/sales.xlsx', res.get('sales_rows', 0))
    ```

- [ ] **Step 3: Write observations at the end of every full or orders-only run**
  - Right before the final `_finish_log(log_id, total_rows)` (the one after the extras block) add:
    ```python
        only_names = None
        if only_file_types is not None:
            only_names = {n for n in os.listdir(ERP_DATA_DIR) if detect_file_type(n) in only_file_types}
        _write_observations(log_id, only_names)
    ```
  - In the `except Exception as e:` block, before the existing `_fail_log(...)` call, add `_write_observations(log_id)`.

- [ ] **Step 4: Unit tests still pass** — `py -3 -m pytest tests -q` → `4 passed`.

- [ ] **Step 5: Run one BETA sync from the main PC**

```powershell
& "\\srv\office\Biz-Dev\Projects\Codding\Management Dashboard\beta\ops\run_sync.bat"
```
Expected: last lines of `beta\logs\sync.log` contain `Observations: <~100> files recorded` and `==== exit 0 ====`.

- [ ] **Step 6: Verify in BETA**

```sql
select file_name, rows_loaded, processed, modified_at from public.source_file_observations
 where observed_at > now() - interval '15 minutes' order by file_name;
```
Expected: `722mt.xls` 38610 processed, `Debt clients.xlsm` ≈473 processed, `rep893pupik.xls` ≈2498, `collectyear008pupik.xls` = rows from the main loop + receipts, `tsomet/budget.xlsx` 75, `Debtmt.xls` processed=false, `723mt.xls` processed=false.

---

### Task 5: Evaluator (TypeScript, TDD)

**Files:**
- Create: `supabase/functions/data-health-check/evaluate.ts`
- Test: `src/lib/dataHealth/evaluate.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { evaluate, effectiveAgeHours, localParts, type Rule, type Latest, type SyncLog } from '../../../supabase/functions/data-health-check/evaluate.ts'

// Israel is UTC+3 (IDT) on these dates.
const at = (iso: string) => new Date(iso)
const rule = (p: Partial<Rule>): Rule => ({
  file_name: 'x.xls', company: 'pupik', file_group: 'p1', fix_hint: 'fix', impact: 'imp',
  rule_kind: 'age', max_age_hours: 4, eval_from: null, eval_to: null, active: true, ...p,
})
const obs = (p: Partial<Latest>): Latest => ({
  file_name: 'x.xls', observed_at: '2026-10-04T09:00:00Z', modified_at: '2026-10-04T09:00:00Z',
  rows_loaded: 100, processed: true, history: [100, 100, 100], ...p,
})
const okSync: SyncLog[] = [{ id: 's', started_at: '2026-10-04T09:50:00Z', status: 'success' }]
const byKey = (r: ReturnType<typeof evaluate>) => Object.fromEntries(r.statuses.map(s => [s.check_key, s]))

describe('localParts', () => {
  it('converts to Asia/Jerusalem', () => {
    const p = localParts(at('2026-10-04T07:30:00Z')) // Sunday 10:30 local
    expect(p).toMatchObject({ weekday: 'Sun', minutes: 630, date: '2026-10-04' })
  })
})

describe('effectiveAgeHours', () => {
  it('does not count Saturday', () => {
    // Fri 2026-10-02 19:00 local -> Sun 2026-10-04 07:00 local = 36 h wall, 12 h without Saturday
    expect(effectiveAgeHours(at('2026-10-02T16:00:00Z'), at('2026-10-04T04:00:00Z'))).toBeCloseTo(12, 0)
  })
})

describe('evaluate', () => {
  it('returns nothing on Saturday or outside 07:00-22:00', () => {
    expect(evaluate({ rules: [rule({})], latest: [obs({})], syncLogs: okSync, now: at('2026-10-03T09:00:00Z') }).statuses).toEqual([])
    expect(evaluate({ rules: [rule({})], latest: [obs({})], syncLogs: okSync, now: at('2026-10-04T20:00:00Z') }).statuses).toEqual([])
  })
  it('age rule: green, amber, red', () => {
    const now = at('2026-10-04T10:00:00Z') // Sun 13:00
    const r = (mod: string) => byKey(evaluate({ rules: [rule({})], latest: [obs({ modified_at: mod })], syncLogs: okSync, now }))['x.xls'].status
    expect(r('2026-10-04T09:00:00Z')).toBe('green') // 1 h
    expect(r('2026-10-04T06:30:00Z')).toBe('amber') // 3.5 h > 75 % of 4
    expect(r('2026-10-04T05:00:00Z')).toBe('red')   // 5 h
  })
  it('skips a rule outside its window', () => {
    const now = at('2026-10-04T05:00:00Z') // Sun 08:00, window 10:00-21:00
    const res = evaluate({ rules: [rule({ eval_from: '10:00', eval_to: '21:00' })], latest: [obs({ modified_at: '2026-10-02T10:00:00Z' })], syncLogs: okSync, now })
    expect(byKey(res)['x.xls']).toBeUndefined()
  })
  it('red when the file was never observed', () => {
    const res = evaluate({ rules: [rule({})], latest: [], syncLogs: okSync, now: at('2026-10-04T10:00:00Z') })
    expect(byKey(res)['x.xls']).toMatchObject({ status: 'red' })
  })
  it('nightly rule: red if not modified today after 04:30', () => {
    const nightly = rule({ rule_kind: 'nightly', max_age_hours: null, eval_from: '04:30', file_group: 'nightly_aski' })
    const now = at('2026-10-04T03:00:00Z') // Sun 06:00 local... but before 07:00 -> skipped
    expect(evaluate({ rules: [nightly], latest: [obs({})], syncLogs: okSync, now }).statuses).toEqual([])
    const later = at('2026-10-04T05:00:00Z') // Sun 08:00
    const old = byKey(evaluate({ rules: [nightly], latest: [obs({ modified_at: '2026-10-02T00:36:00Z' })], syncLogs: okSync, now: later }))['x.xls']
    const fresh = byKey(evaluate({ rules: [nightly], latest: [obs({ modified_at: '2026-10-04T00:36:00Z' })], syncLogs: okSync, now: later }))['x.xls']
    expect(old.status).toBe('red'); expect(fresh.status).toBe('green')
  })
  it('frozen rule is grey', () => {
    const res = evaluate({ rules: [rule({ rule_kind: 'frozen', max_age_hours: null, file_group: 'frozen' })], latest: [obs({ modified_at: '2025-01-01T00:00:00Z' })], syncLogs: okSync, now: at('2026-10-04T10:00:00Z') })
    expect(byKey(res)['x.xls'].status).toBe('grey')
  })
  it('rows check: zero after non-zero, and under 70 % of the median (the 2026-10-03 722mt half load)', () => {
    const now = at('2026-10-04T10:00:00Z')
    const zero = byKey(evaluate({ rules: [rule({})], latest: [obs({ rows_loaded: 0, history: [38610] })], syncLogs: okSync, now }))['rows:x.xls']
    const half = byKey(evaluate({ rules: [rule({})], latest: [obs({ rows_loaded: 23500, history: [38610, 38600, 38590] })], syncLogs: okSync, now }))['rows:x.xls']
    const ok = byKey(evaluate({ rules: [rule({})], latest: [obs({ rows_loaded: 38600, history: [38610, 38600, 38590] })], syncLogs: okSync, now }))['rows:x.xls']
    expect(zero.status).toBe('red'); expect(half.status).toBe('red'); expect(ok.status).toBe('green')
  })
  it('sync health: no success in 2 h, stuck running, superseded running ignored', () => {
    const now = at('2026-10-04T10:00:00Z') // Sun 13:00
    const stale = byKey(evaluate({ rules: [], latest: [], syncLogs: [{ id: 'a', started_at: '2026-10-04T07:00:00Z', status: 'success' }], now }))
    expect(stale['sync:no_success'].status).toBe('red')
    const stuck = byKey(evaluate({ rules: [], latest: [], now, syncLogs: [
      { id: 'b', started_at: '2026-10-04T09:00:00Z', status: 'running' },
      { id: 'c', started_at: '2026-10-04T08:50:00Z', status: 'success' } ] }))
    expect(stuck['sync:stuck'].status).toBe('red')
    const superseded = byKey(evaluate({ rules: [], latest: [], now, syncLogs: [
      { id: 'd', started_at: '2026-10-04T09:30:00Z', status: 'success' },
      { id: 'e', started_at: '2026-10-04T08:45:00Z', status: 'running' } ] }))
    expect(superseded['sync:stuck'].status).toBe('green')
  })
  it('reports processed files without a rule as unruled', () => {
    const res = evaluate({ rules: [], latest: [obs({ file_name: 'new.xls' }), obs({ file_name: 'skip.xls', processed: false })], syncLogs: okSync, now: at('2026-10-04T10:00:00Z') })
    expect(res.unruled).toEqual(['new.xls'])
  })
})
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run src/lib/dataHealth/evaluate.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// Pure evaluation for the data health monitor. No Deno or browser APIs: imported by the
// edge function and by vitest.
export type Rule = {
  file_name: string; company: string | null; file_group: string; fix_hint: string; impact: string
  rule_kind: 'age' | 'nightly' | 'frozen'; max_age_hours: number | null
  eval_from: string | null; eval_to: string | null; active: boolean
}
export type Latest = {
  file_name: string; observed_at: string; modified_at: string | null
  rows_loaded: number | null; processed: boolean; history: number[]
}
export type SyncLog = { id: string; started_at: string; status: string }
export type Colour = 'green' | 'amber' | 'red' | 'grey'
export type Status = {
  check_key: string; file_name: string | null; file_group: string; company: string | null
  status: Colour; reason: string; modified_at: string | null; age_hours: number | null; rows_loaded: number | null
}
export type EvalInput = { rules: Rule[]; latest: Latest[]; syncLogs: SyncLog[]; now: Date }

const TZ = 'Asia/Jerusalem'
const DAY_FROM = 7 * 60, DAY_TO = 22 * 60          // checker active window (local)
const SYNC_FROM = 8 * 60                            // sync-health window starts 08:00
const H = 3_600_000

export function localParts(d: Date): { weekday: string; minutes: number; date: string } {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  const p = Object.fromEntries(f.formatToParts(d).map(x => [x.type, x.value]))
  return { weekday: p.weekday, minutes: Number(p.hour) * 60 + Number(p.minute), date: `${p.year}-${p.month}-${p.day}` }
}

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0) }

/** Wall-clock hours between two instants, minus every Saturday hour in between (no work on Saturday). */
export function effectiveAgeHours(from: Date, to: Date): number {
  let hours = (to.getTime() - from.getTime()) / H
  // Walk local days in 1-hour steps only across Saturdays; cheap enough for ages up to ~60 days.
  for (let t = from.getTime(); t < to.getTime(); t += H) {
    if (localParts(new Date(t)).weekday === 'Sat') hours -= Math.min(1, (to.getTime() - t) / H)
  }
  return Math.max(0, hours)
}

export const fmtAge = (h: number) => (h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} days`)

export function evaluate({ rules, latest, syncLogs, now }: EvalInput): { statuses: Status[]; unruled: string[] } {
  const local = localParts(now)
  const ruled = new Set(rules.map(r => r.file_name.toLowerCase()))
  const unruled = latest.filter(l => l.processed && !ruled.has(l.file_name.toLowerCase())).map(l => l.file_name).sort()
  if (local.weekday === 'Sat' || local.minutes < DAY_FROM || local.minutes > DAY_TO) return { statuses: [], unruled }

  const byFile = new Map(latest.map(l => [l.file_name.toLowerCase(), l]))
  const out: Status[] = []

  for (const r of rules) {
    if (!r.active) continue
    if (r.eval_from && local.minutes < toMin(r.eval_from)) continue
    if (r.eval_to && local.minutes > toMin(r.eval_to)) continue
    const l = byFile.get(r.file_name.toLowerCase())
    const base = { check_key: r.file_name, file_name: r.file_name, file_group: r.file_group, company: r.company }
    if (!l || !l.modified_at) {
      out.push({ ...base, status: r.rule_kind === 'frozen' ? 'grey' : 'red', reason: `${r.file_name} was not found by the sync`,
        modified_at: null, age_hours: null, rows_loaded: null })
      continue
    }
    const mod = new Date(l.modified_at)
    const age = effectiveAgeHours(mod, now)
    const common = { modified_at: l.modified_at, age_hours: Math.round(age * 10) / 10, rows_loaded: l.rows_loaded }
    if (r.rule_kind === 'frozen') {
      out.push({ ...base, ...common, status: 'grey', reason: 'frozen (historical) - not checked' })
    } else if (r.rule_kind === 'nightly') {
      const fresh = localParts(mod).date === local.date
      out.push({ ...base, ...common, status: fresh ? 'green' : 'red',
        reason: fresh ? 'refreshed overnight' : `${r.file_name} was not refreshed overnight (last ${localParts(mod).date})` })
    } else {
      const limit = r.max_age_hours ?? 0
      const status: Colour = age > limit ? 'red' : age > 0.75 * limit ? 'amber' : 'green'
      out.push({ ...base, ...common, status,
        reason: status === 'green' ? `${fmtAge(age)} old` : `${r.file_name} is ${fmtAge(age)} old (limit ${fmtAge(limit)})` })
    }
    if (r.rule_kind !== 'frozen' && l.processed && l.rows_loaded !== null) {
      const hist = l.history ?? []
      const sorted = [...hist].sort((a, b) => a - b)
      const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0
      let bad: string | null = null
      if (l.rows_loaded === 0 && (hist[0] ?? 0) > 0) bad = `${r.file_name} loaded 0 rows (previous run ${hist[0]})`
      else if (hist.length >= 3 && l.rows_loaded < 0.7 * median) bad = `${r.file_name} loaded ${l.rows_loaded} rows, usually ${median}`
      out.push({ ...base, check_key: `rows:${r.file_name}`, status: bad ? 'red' : 'green', reason: bad ?? `${l.rows_loaded} rows`,
        modified_at: l.modified_at, age_hours: null, rows_loaded: l.rows_loaded })
    }
  }

  if (local.minutes >= SYNC_FROM) {
    const sorted = [...syncLogs].sort((a, b) => b.started_at.localeCompare(a.started_at))
    const lastOk = sorted.find(s => s.status === 'success')
    const okAge = lastOk ? (now.getTime() - new Date(lastOk.started_at).getTime()) / H : Infinity
    out.push({ check_key: 'sync:no_success', file_name: null, file_group: 'sync', company: null,
      status: okAge > 2 ? 'red' : 'green', modified_at: lastOk?.started_at ?? null, age_hours: isFinite(okAge) ? Math.round(okAge * 10) / 10 : null,
      rows_loaded: null, reason: okAge > 2 ? `No successful sync for ${isFinite(okAge) ? fmtAge(okAge) : 'a long time'} - is smartpupik running?` : 'syncing normally' })
    const stuck = sorted.find(s => s.status === 'running'
      && (now.getTime() - new Date(s.started_at).getTime()) / H > 0.75
      && !sorted.some(o => o.status === 'success' && o.started_at > s.started_at))
    out.push({ check_key: 'sync:stuck', file_name: null, file_group: 'sync', company: null,
      status: stuck ? 'red' : 'green', modified_at: stuck?.started_at ?? null, age_hours: null, rows_loaded: null,
      reason: stuck ? `A sync started ${stuck.started_at} is still 'running' (interrupted?)` : 'no stuck sync' })
  }
  return { statuses: out, unruled }
}
```

- [ ] **Step 4: Run to verify pass** — same command → all tests pass. Then `npm run typecheck` → no errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/data-health-check/evaluate.ts src/lib/dataHealth/evaluate.test.ts
git commit -m "Add data health evaluator with tests"
```

---

### Task 6: Incident planner (TDD)

**Files:**
- Create: `supabase/functions/data-health-check/incidents.ts`
- Test: `src/lib/dataHealth/incidents.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { planIncidents, type OpenIncident } from '../../../supabase/functions/data-health-check/incidents.ts'
import type { Status } from '../../../supabase/functions/data-health-check/evaluate.ts'

const st = (key: string, status: Status['status']): Status => ({ check_key: key, file_name: key, file_group: 'p1', company: null, status, reason: `${key} ${status}`, modified_at: null, age_hours: null, rows_loaded: null })
const inc = (p: Partial<OpenIncident>): OpenIncident => ({ id: 1, check_key: 'a', opened_at: '2026-10-04T05:00:00Z', acknowledged_at: null, last_notified_at: '2026-10-04T05:00:00Z', reason: 'r', ...p })
const now = new Date('2026-10-04T10:00:00Z')

describe('planIncidents', () => {
  it('opens on new red, ignores amber/green/grey', () => {
    const p = planIncidents([st('a', 'red'), st('b', 'amber'), st('c', 'green'), st('d', 'grey')], [], now)
    expect(p.open.map(s => s.check_key)).toEqual(['a']); expect(p.close).toEqual([]); expect(p.remind).toEqual([])
  })
  it('closes when an open incident is no longer red', () => {
    const p = planIncidents([st('a', 'green')], [inc({})], now)
    expect(p.close.map(i => i.id)).toEqual([1])
  })
  it('keeps open incidents for checks not evaluated this run', () => {
    expect(planIncidents([], [inc({})], now).close).toEqual([])
  })
  it('reminds after 24 h unless acknowledged', () => {
    const old = inc({ last_notified_at: '2026-10-03T09:00:00Z' })
    expect(planIncidents([st('a', 'red')], [old], now).remind.map(i => i.id)).toEqual([1])
    expect(planIncidents([st('a', 'red')], [{ ...old, acknowledged_at: '2026-10-03T10:00:00Z' }], now).remind).toEqual([])
    expect(planIncidents([st('a', 'red')], [inc({})], now).remind).toEqual([])
  })
  it('retries an alert that was never sent', () => {
    expect(planIncidents([st('a', 'red')], [inc({ last_notified_at: null })], now).remind.map(i => i.id)).toEqual([1])
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/dataHealth/incidents.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
import type { Status } from './evaluate.ts'

export type OpenIncident = {
  id: number; check_key: string; opened_at: string; acknowledged_at: string | null
  last_notified_at: string | null; reason: string
}
export type Plan = { open: Status[]; close: OpenIncident[]; remind: OpenIncident[] }

const DAY = 86_400_000

export function planIncidents(statuses: Status[], openIncidents: OpenIncident[], now: Date): Plan {
  const byKey = new Map(openIncidents.map(i => [i.check_key, i]))
  const plan: Plan = { open: [], close: [], remind: [] }
  for (const s of statuses) {
    const inc = byKey.get(s.check_key)
    if (s.status === 'red') {
      if (!inc) plan.open.push(s)
      else if (!inc.acknowledged_at
        && (!inc.last_notified_at || now.getTime() - new Date(inc.last_notified_at).getTime() >= DAY)) plan.remind.push(inc)
    } else if (inc && s.status !== 'grey') {
      plan.close.push(inc)
    }
  }
  return plan
}
```

- [ ] **Step 4: Run** → pass. **Step 5: Commit**

```bash
git add supabase/functions/data-health-check/incidents.ts src/lib/dataHealth/incidents.test.ts
git commit -m "Add data health incident planner with tests"
```

---

### Task 7: Email composer (TDD)

**Files:**
- Create: `supabase/functions/data-health-check/emails.ts`
- Test: `src/lib/dataHealth/emails.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { alertEmail, resolvedEmail, summaryEmail, durationText } from '../../../supabase/functions/data-health-check/emails.ts'

const s = { check_key: '855PUP.xls', file_name: '855PUP.xls', file_group: 'manual_sales', company: 'pupik', status: 'red' as const, reason: '855PUP.xls is 9 days old (limit 7 days)', modified_at: null, age_hours: 216, rows_loaded: null }
const rule = { fix_hint: 'Run REP855&854ALL.BAT', impact: 'returns MTD' }
const url = 'https://example.app/admin/data-health'

describe('emails', () => {
  it('alert subject and body', () => {
    const e = alertEmail(s, rule, url, false)
    expect(e.subject).toBe('[Dashboard data] RED: 855PUP.xls is 9 days old (limit 7 days)')
    expect(e.text).toContain('Run REP855&854ALL.BAT'); expect(e.text).toContain('returns MTD'); expect(e.text).toContain(url)
    expect(alertEmail(s, rule, url, true).subject).toMatch(/^\[Dashboard data\] STILL RED:/)
  })
  it('resolved subject with duration', () => {
    expect(resolvedEmail('855PUP.xls', '2026-10-02T06:00:00Z', new Date('2026-10-04T10:00:00Z'), url).subject)
      .toBe('[Dashboard data] OK again: 855PUP.xls (was red 2 d 4 h)')
  })
  it('duration text', () => { expect(durationText(3 * 3_600_000)).toBe('3 h'); expect(durationText(50 * 3_600_000)).toBe('2 d 2 h') })
  it('summary counts', () => {
    const e = summaryEmail({ statuses: [s, { ...s, check_key: 'a', status: 'green' }, { ...s, check_key: 'b', status: 'amber' }], openCount: 1, unruled: ['new.xls'], dateLabel: 'Sun 04-Oct', url })
    expect(e.subject).toBe('[Dashboard data] Daily status Sun 04-Oct: 1 red, 1 amber, 1 green')
    expect(e.text).toContain('new.xls')
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/dataHealth/emails.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
import type { Status } from './evaluate.ts'

export type Email = { subject: string; text: string; html: string }
const P = '[Dashboard data]'
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const toHtml = (text: string) => `<pre style="font-family:Segoe UI,Arial,sans-serif;white-space:pre-wrap">${esc(text)}</pre>`
const mk = (subject: string, text: string): Email => ({ subject, text, html: toHtml(text) })

export function durationText(ms: number): string {
  const h = Math.round(ms / 3_600_000)
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d ${h % 24} h`
}

export function alertEmail(s: Status, rule: { fix_hint: string; impact: string } | undefined, url: string, reminder: boolean): Email {
  const text = [
    s.reason,
    s.modified_at ? `Last modified: ${s.modified_at}` : '',
    rule ? `Affects: ${rule.impact}` : '',
    rule ? `How to fix: ${rule.fix_hint}` : '',
    `Group: ${s.file_group}`,
    `Details: ${url}`,
  ].filter(Boolean).join('\n')
  return mk(`${P} ${reminder ? 'STILL RED' : 'RED'}: ${s.reason}`, text)
}

export function resolvedEmail(checkKey: string, openedAt: string, now: Date, url: string): Email {
  const d = durationText(now.getTime() - new Date(openedAt).getTime())
  return mk(`${P} OK again: ${checkKey} (was red ${d})`, `${checkKey} is OK again after ${d}.\nDetails: ${url}`)
}

export function summaryEmail(a: { statuses: Status[]; openCount: number; unruled: string[]; dateLabel: string; url: string }): Email {
  const n = (c: Status['status']) => a.statuses.filter(s => s.status === c).length
  const lines: string[] = [`Open incidents: ${a.openCount}`, '']
  const groups = [...new Set(a.statuses.map(s => s.file_group))].sort()
  for (const g of groups) {
    lines.push(`== ${g}`)
    for (const s of a.statuses.filter(x => x.file_group === g)) lines.push(`  ${s.status.toUpperCase().padEnd(5)} ${s.check_key}: ${s.reason}`)
  }
  if (a.unruled.length) lines.push('', `Loaded by the sync but not monitored (add a rule): ${a.unruled.join(', ')}`)
  lines.push('', `Details: ${a.url}`)
  return mk(`${P} Daily status ${a.dateLabel}: ${n('red')} red, ${n('amber')} amber, ${n('green')} green`, lines.join('\n'))
}
```

- [ ] **Step 4: Run** → pass. **Step 5: Commit**

```bash
git add supabase/functions/data-health-check/emails.ts src/lib/dataHealth/emails.test.ts
git commit -m "Add data health email composer with tests"
```

---

### Task 8: Edge function and BETA deployment

**Files:**
- Create: `supabase/functions/data-health-check/index.ts`

- [ ] **Step 1: Implement**

```ts
// data-health-check: started every 30 min by pg_cron (see migration 20261003130200).
// Loads rules + latest observations, evaluates, writes source_file_status, manages incidents,
// sends email via Resend, sends the daily summary once per working day, prunes old observations.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { evaluate, localParts, type Rule, type Latest, type SyncLog, type Status } from './evaluate.ts'
import { planIncidents, type OpenIncident } from './incidents.ts'
import { alertEmail, resolvedEmail, summaryEmail, type Email } from './emails.ts'

const PAGE_URL = Deno.env.get('DATA_HEALTH_PAGE_URL') ?? 'https://pupik-sales-dashboard-beta.vercel.app/admin/data-health'

Deno.serve(async () => {
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const now = new Date()
  const log: string[] = []

  const [rulesQ, latestQ, syncQ, openQ, setQ] = await Promise.all([
    sb.from('source_files').select('*'),
    sb.rpc('data_health_latest'),
    sb.from('sync_logs').select('id, started_at, status').order('started_at', { ascending: false }).limit(50),
    sb.from('data_health_incidents').select('id, check_key, opened_at, acknowledged_at, last_notified_at, reason').is('closed_at', null),
    sb.from('data_health_settings').select('*').eq('id', true).single(),
  ])
  for (const q of [rulesQ, latestQ, syncQ, openQ, setQ]) if (q.error) return json({ error: q.error.message }, 500)
  const rules = rulesQ.data as Rule[]
  const settings = setQ.data as { recipients: string[]; from_address: string; summary_time: string; enabled: boolean; last_summary_date: string | null }
  const ruleByKey = new Map(rules.map(r => [r.file_name, r]))

  const { statuses, unruled } = evaluate({ rules, latest: latestQ.data as Latest[], syncLogs: syncQ.data as SyncLog[], now })
  if (statuses.length) {
    const up = await sb.from('source_file_status').upsert(statuses.map(s => ({ ...s, evaluated_at: now.toISOString() })))
    if (up.error) return json({ error: up.error.message }, 500)
  }

  const send = async (e: Email): Promise<boolean> => {
    if (!settings.enabled || !settings.recipients.length) return false
    const key = Deno.env.get('RESEND_API_KEY')
    if (!key) { log.push('RESEND_API_KEY missing'); return false }
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: settings.from_address, to: settings.recipients, subject: e.subject, text: e.text, html: e.html }),
    })
    if (!r.ok) log.push(`resend ${r.status}: ${await r.text()}`)
    return r.ok
  }
  const ruleFor = (s: Status) => ruleByKey.get(s.file_name ?? '')

  const plan = planIncidents(statuses, openQ.data as OpenIncident[], now)
  for (const s of plan.open) {
    const ins = await sb.from('data_health_incidents').insert({ check_key: s.check_key, reason: s.reason }).select('id').single()
    if (ins.error) { log.push(ins.error.message); continue }
    if (await send(alertEmail(s, ruleFor(s), PAGE_URL, false)))
      await sb.from('data_health_incidents').update({ last_notified_at: now.toISOString() }).eq('id', ins.data.id)
  }
  const byKey = new Map(statuses.map(s => [s.check_key, s]))
  for (const i of plan.remind) {
    const s = byKey.get(i.check_key)!
    if (await send(alertEmail(s, ruleFor(s), PAGE_URL, i.last_notified_at !== null)))
      await sb.from('data_health_incidents').update({ last_notified_at: now.toISOString() }).eq('id', i.id)
  }
  for (const i of plan.close) {
    await sb.from('data_health_incidents').update({ closed_at: now.toISOString() }).eq('id', i.id)
    await send(resolvedEmail(i.check_key, i.opened_at, now, PAGE_URL))
  }

  // Daily summary: first run on a working day at/after summary_time.
  const local = localParts(now)
  const [sh, sm] = settings.summary_time.split(':').map(Number)
  if (local.weekday !== 'Sat' && local.minutes >= sh * 60 + sm && settings.last_summary_date !== local.date) {
    const all = await sb.from('source_file_status').select('*').order('file_group')
    const open = await sb.from('data_health_incidents').select('id', { count: 'exact', head: true }).is('closed_at', null)
    const label = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jerusalem', weekday: 'short', day: '2-digit', month: 'short' }).format(now)
    if (await send(summaryEmail({ statuses: (all.data ?? []) as Status[], openCount: open.count ?? 0, unruled, dateLabel: label, url: PAGE_URL })))
      await sb.from('data_health_settings').update({ last_summary_date: local.date }).eq('id', true)
    await sb.from('source_file_observations').delete().lt('observed_at', new Date(now.getTime() - 365 * 86_400_000).toISOString())
  }

  return json({ evaluated: statuses.length, opened: plan.open.length, reminded: plan.remind.length, closed: plan.close.length, unruled, log })
})

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })
```

- [ ] **Step 2: Typecheck the pure files still pass** — `npx vitest run src/lib/dataHealth` → all pass.

- [ ] **Step 3: Deploy to BETA** — MCP `deploy_edge_function`, project `qwtfsnkabvbxurwduvyn`, name `data-health-check`, entrypoint `index.ts`, files: `index.ts`, `evaluate.ts`, `incidents.ts`, `emails.ts` (contents from the repo). Expected: ACTIVE.

- [ ] **Step 4: Invoke once by hand** (anon key from MCP `get_publishable_keys` for BETA, legacy anon JWT):

```powershell
$k = '<BETA anon JWT>'; Invoke-RestMethod -Method Post -Uri 'https://qwtfsnkabvbxurwduvyn.supabase.co/functions/v1/data-health-check' -Headers @{ Authorization = "Bearer $k" } -ContentType 'application/json' -Body '{}'
```
Expected (on a working day 07:00–22:00): `evaluated` > 0, `log` empty; `select status, count(*) from source_file_status group by 1` shows green/amber/red/grey. Outside the window: `evaluated: 0` (correct). Reds that match the pre-acknowledged incidents produce no email.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/data-health-check/index.ts
git commit -m "Add data-health-check edge function"
```

---

### Task 9: Schedule (pg_cron) on BETA

**Files:**
- Create: `supabase/migrations/20261003130200_data_health_cron.sql`

- [ ] **Step 1: Store the function URL and anon key in vault (per project, not a migration)** — MCP `execute_sql` on BETA:

```sql
select vault.create_secret('https://qwtfsnkabvbxurwduvyn.supabase.co/functions/v1/data-health-check', 'data_health_function_url');
select vault.create_secret('<BETA anon JWT>', 'data_health_anon_key');
```
(The anon key is the public client key, not a secret credential.)

- [ ] **Step 2: Write the migration**

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'data-health-check';
select cron.schedule('data-health-check', '*/30 * * * *', $job$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'data_health_function_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'data_health_anon_key')),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000);
$job$);
```

- [ ] **Step 3: Apply to BETA** (`data_health_cron`) and verify after 30 min:

```sql
select jobname, schedule, active from cron.job where jobname = 'data-health-check';
select status_code, created from net._http_response order by created desc limit 3;
```
Expected: job active; responses with `status_code` 200.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261003130200_data_health_cron.sql
git commit -m "Schedule data-health-check every 30 minutes"
```

---

### Task 10: End-to-end email test on BETA

- [ ] **Step 1: Force a red** — BETA SQL: `update source_files set max_age_hours = 0.1 where file_name = '000mt.xls';` then invoke the function (Task 8 Step 4 command).
Expected: email "[Dashboard data] RED: 000mt.xls is … old (limit 0 h)" arrives at pupikoffice@gmail.com; an open incident for `000mt.xls` exists with `last_notified_at` set.
- [ ] **Step 2: Resolve** — `update source_files set max_age_hours = 30 where file_name = '000mt.xls';` invoke again.
Expected: email "[Dashboard data] OK again: 000mt.xls (was red …)"; incident has `closed_at`.
- [ ] **Step 3: Summary** — `update data_health_settings set last_summary_date = null;` invoke (after 07:30 on a working day).
Expected: "[Dashboard data] Daily status …" email listing all groups; `last_summary_date` = today.
- [ ] **Step 4: If no email arrives** — check the function response `log` (Resend error text) and Supabase function logs; common cause: `RESEND_API_KEY` missing on BETA, or a recipient that is not the Resend account owner while using `onboarding@resend.dev`.

---

### Task 11: Timeline helpers (TDD)

**Files:**
- Create: `src/lib/dataHealth/timeline.ts`
- Test: `src/lib/dataHealth/timeline.test.ts`

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { redSegments, monthlyStats, type IncidentRow } from './timeline'

const i = (p: Partial<IncidentRow>): IncidentRow => ({ id: 1, check_key: 'a', opened_at: '2026-10-01T00:00:00Z', closed_at: '2026-10-01T06:00:00Z', reason: 'r', acknowledged_at: null, notes: null, ...p })

describe('timeline', () => {
  it('clips incidents to the window and marks open ones until now', () => {
    const from = new Date('2026-10-01T03:00:00Z'), to = new Date('2026-10-02T00:00:00Z')
    const segs = redSegments([i({}), i({ id: 2, opened_at: '2026-10-01T20:00:00Z', closed_at: null })], from, to)
    const r = (x: number) => Math.round(x * 1000) / 1000
    expect(segs.map(s => ({ ...s, startPct: r(s.startPct), endPct: r(s.endPct) }))).toEqual([
      { startPct: 0, endPct: r(3 / 21 * 100), open: false },
      { startPct: r(17 / 21 * 100), endPct: 100, open: true },
    ])
  })
  it('monthly stats per group: count and average hours to fix', () => {
    const groupOf = (k: string) => (k === 'a' ? 'p1' : 'manual_sales')
    const s = monthlyStats([i({}), i({ id: 2, closed_at: '2026-10-01T02:00:00Z' }), i({ id: 3, check_key: 'b', closed_at: null })], groupOf)
    expect(s).toEqual([
      { month: '2026-10', group: 'manual_sales', count: 1, avgHoursToFix: null },
      { month: '2026-10', group: 'p1', count: 2, avgHoursToFix: 4 },
    ])
  })
})
```

- [ ] **Step 2: Run** `npx vitest run src/lib/dataHealth/timeline.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
export type IncidentRow = {
  id: number; check_key: string; opened_at: string; closed_at: string | null
  reason: string; acknowledged_at: string | null; notes: string | null
}
export type Segment = { startPct: number; endPct: number; open: boolean }

export function redSegments(incidents: IncidentRow[], from: Date, to: Date): Segment[] {
  const span = to.getTime() - from.getTime()
  return incidents
    .map(i => {
      const s = Math.max(new Date(i.opened_at).getTime(), from.getTime())
      const e = Math.min(i.closed_at ? new Date(i.closed_at).getTime() : to.getTime(), to.getTime())
      return e > s ? { startPct: ((s - from.getTime()) / span) * 100, endPct: ((e - from.getTime()) / span) * 100, open: !i.closed_at } : null
    })
    .filter((x): x is Segment => x !== null)
    .sort((a, b) => a.startPct - b.startPct)
}

export function monthlyStats(incidents: IncidentRow[], groupOf: (checkKey: string) => string) {
  const acc = new Map<string, { month: string; group: string; count: number; fixed: number[] }>()
  for (const i of incidents) {
    const month = i.opened_at.slice(0, 7), group = groupOf(i.check_key), k = `${month}|${group}`
    const row = acc.get(k) ?? { month, group, count: 0, fixed: [] }
    row.count++
    if (i.closed_at) row.fixed.push((new Date(i.closed_at).getTime() - new Date(i.opened_at).getTime()) / 3_600_000)
    acc.set(k, row)
  }
  return [...acc.values()]
    .map(r => ({ month: r.month, group: r.group, count: r.count,
      avgHoursToFix: r.fixed.length ? Math.round((r.fixed.reduce((a, b) => a + b, 0) / r.fixed.length) * 10) / 10 : null }))
    .sort((a, b) => b.month.localeCompare(a.month) || a.group.localeCompare(b.group))
}
```

- [ ] **Step 4: Run** → pass. **Step 5: Commit**

```bash
git add src/lib/dataHealth/timeline.ts src/lib/dataHealth/timeline.test.ts
git commit -m "Add data health timeline helpers with tests"
```

---

### Task 12: Data access, hooks, page, route and nav

**Files:**
- Create: `src/lib/dataHealth/api.ts`, `src/hooks/useDataHealth.ts`, `src/pages/admin/DataHealthPage.tsx`
- Modify: `src/App.tsx` (route next to `admin/modules`, line ~52), `src/pages/DashboardLayout.tsx` (nav link next to the `/admin/modules` NavLink, line ~178)

- [ ] **Step 1: `src/lib/dataHealth/api.ts`**

```ts
import { supabase } from '../supabase'
import type { IncidentRow } from './timeline'

export type StatusRow = {
  check_key: string; file_name: string | null; file_group: string; company: string | null
  status: 'green' | 'amber' | 'red' | 'grey'; reason: string; modified_at: string | null
  age_hours: number | null; rows_loaded: number | null; evaluated_at: string
}
export type RuleRow = { file_name: string; file_group: string; producer: string; fix_hint: string; impact: string }

export async function fetchStatuses(): Promise<StatusRow[]> {
  const { data, error } = await supabase.from('source_file_status').select('*').order('file_group').order('check_key')
  if (error) throw error
  return data as StatusRow[]
}
export async function fetchRules(): Promise<RuleRow[]> {
  const { data, error } = await supabase.from('source_files').select('file_name, file_group, producer, fix_hint, impact')
  if (error) throw error
  return data as RuleRow[]
}
export async function fetchIncidents(sinceDays: number): Promise<IncidentRow[]> {
  const since = new Date(Date.now() - sinceDays * 86_400_000).toISOString()
  const { data, error } = await supabase.from('data_health_incidents')
    .select('id, check_key, opened_at, closed_at, reason, acknowledged_at, notes')
    .or(`closed_at.is.null,opened_at.gte.${since}`).order('opened_at', { ascending: false }).limit(2000)
  if (error) throw error
  return data as IncidentRow[]
}
export async function acknowledgeIncident(id: number, notes: string | null): Promise<void> {
  const { error } = await supabase.rpc('data_health_ack', { p_incident_id: id, p_notes: notes })
  if (error) throw error
}
```

- [ ] **Step 2: `src/hooks/useDataHealth.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { fetchIncidents, fetchRules, fetchStatuses } from '../lib/dataHealth/api'

export const useDataHealthStatuses = () => useQuery({ queryKey: ['dataHealth', 'status'], queryFn: fetchStatuses, refetchInterval: 60_000 })
export const useDataHealthRules = () => useQuery({ queryKey: ['dataHealth', 'rules'], queryFn: fetchRules })
export const useDataHealthIncidents = (days: number) =>
  useQuery({ queryKey: ['dataHealth', 'incidents', days], queryFn: () => fetchIncidents(days), refetchInterval: 60_000 })
```

- [ ] **Step 3: `src/pages/admin/DataHealthPage.tsx`**

```tsx
import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useDataHealthIncidents, useDataHealthRules, useDataHealthStatuses } from '../../hooks/useDataHealth'
import { acknowledgeIncident } from '../../lib/dataHealth/api'
import { monthlyStats, redSegments } from '../../lib/dataHealth/timeline'

const COLOUR: Record<string, string> = { green: '#2e7d32', amber: '#ed8c00', red: '#c62828', grey: '#9e9e9e' }
const age = (h: number | null) => (h === null ? '-' : h < 48 ? `${Math.round(h)} h` : `${Math.round(h / 24)} d`)

export function DataHealthPage() {
  const [days, setDays] = useState(30)
  const statuses = useDataHealthStatuses()
  const rules = useDataHealthRules()
  const incidents = useDataHealthIncidents(days)
  const qc = useQueryClient()
  const ack = useMutation({
    mutationFn: ({ id, notes }: { id: number; notes: string | null }) => acknowledgeIncident(id, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dataHealth'] }),
  })

  const ruleBy = useMemo(() => new Map((rules.data ?? []).map(r => [r.file_name, r])), [rules.data])
  const groups = useMemo(() => {
    const m = new Map<string, NonNullable<typeof statuses.data>>()
    for (const s of statuses.data ?? []) m.set(s.file_group, [...(m.get(s.file_group) ?? []), s])
    return [...m.entries()]
  }, [statuses.data])
  const open = (incidents.data ?? []).filter(i => !i.closed_at)
  const to = new Date(), from = new Date(to.getTime() - days * 86_400_000)
  const groupOf = (k: string) => statuses.data?.find(s => s.check_key === k)?.file_group ?? 'other'
  const stats = monthlyStats(incidents.data ?? [], groupOf)

  if (statuses.isLoading) return <div className="p-4">Loading…</div>
  if (statuses.error) return <div className="p-4 text-red-700">Failed to load: {String(statuses.error)}</div>

  return (
    <div className="p-4 space-y-6">
      <h1 className="text-xl font-semibold">Data health</h1>

      <section>
        <h2 className="font-semibold mb-2">Open incidents ({open.length})</h2>
        {open.length === 0 && <p className="text-sm text-gray-500">None.</p>}
        <ul className="space-y-2">
          {open.map(i => (
            <li key={i.id} className="border rounded p-2 text-sm">
              <div><b>{i.check_key}</b> — {i.reason} (since {new Date(i.opened_at).toLocaleString()})</div>
              <div className="text-gray-600">{ruleBy.get(i.check_key)?.fix_hint}</div>
              {i.acknowledged_at
                ? <div className="text-gray-500">Acknowledged {new Date(i.acknowledged_at).toLocaleString()}{i.notes ? ` — ${i.notes}` : ''}</div>
                : <button className="nav-btn mt-1" disabled={ack.isPending}
                    onClick={() => ack.mutate({ id: i.id, notes: window.prompt('Note (optional)') || null })}>Acknowledge</button>}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-2">
          <h2 className="font-semibold">Files</h2>
          <select value={days} onChange={e => setDays(Number(e.target.value))} className="border rounded px-1 text-sm">
            <option value={30}>30 days</option><option value={90}>90 days</option>
          </select>
        </div>
        {groups.map(([g, rows]) => (
          <div key={g} className="mb-4">
            <h3 className="font-medium">{g}</h3>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500"><th>Check</th><th>Status</th><th>Age</th><th>Reason</th><th>Producer / fix</th><th className="w-48">Last {days} days</th></tr></thead>
              <tbody>
                {rows.map(s => {
                  const segs = redSegments((incidents.data ?? []).filter(i => i.check_key === s.check_key), from, to)
                  const r = ruleBy.get(s.file_name ?? '')
                  return (
                    <tr key={s.check_key} className="border-t align-top">
                      <td>{s.check_key}</td>
                      <td><span style={{ color: COLOUR[s.status] }}>● {s.status}</span></td>
                      <td>{age(s.age_hours)}</td>
                      <td>{s.reason}</td>
                      <td>{r ? `${r.producer} — ${r.fix_hint}` : ''}</td>
                      <td>
                        <div className="relative h-3 bg-green-100 rounded" title="red = incident">
                          {segs.map((x, n) => (
                            <div key={n} className="absolute h-3 rounded" style={{ left: `${x.startPct}%`, width: `${Math.max(0.5, x.endPct - x.startPct)}%`, background: COLOUR.red, opacity: x.open ? 1 : 0.7 }} />
                          ))}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      <section>
        <h2 className="font-semibold mb-2">Monthly totals</h2>
        <table className="text-sm">
          <thead><tr className="text-left text-gray-500"><th className="pr-4">Month</th><th className="pr-4">Group</th><th className="pr-4">Incidents</th><th>Avg hours to fix</th></tr></thead>
          <tbody>{stats.map(s => <tr key={`${s.month}|${s.group}`}><td className="pr-4">{s.month}</td><td className="pr-4">{s.group}</td><td className="pr-4">{s.count}</td><td>{s.avgHoursToFix ?? '-'}</td></tr>)}</tbody>
        </table>
      </section>
    </div>
  )
}
```

- [ ] **Step 4: Route** — `src/App.tsx`: add `import { DataHealthPage } from './pages/admin/DataHealthPage'` next to the `ModulesPage` import, and after the `admin/modules` route:

```tsx
        {isSuperAdmin && <Route path="admin/data-health" element={<DataHealthPage />} />}
```

- [ ] **Step 5: Nav link** — `src/pages/DashboardLayout.tsx`: copy the whole `{isSuperAdmin && ( <NavLink to="/admin/modules" … > … </NavLink> )}` block directly below itself; change `to` to `"/admin/data-health"` and its visible label to `Data health`.

- [ ] **Step 6: Verify** — `npm run build` (typecheck + build) passes; `npx vitest run` all pass; start `sales-dashboard-dev` preview, log in with the test super-admin login, open `/admin/data-health`: groups render, reds from the pre-acknowledged incidents show, timeline bars render.

- [ ] **Step 7: Commit**

```bash
git add src/lib/dataHealth/api.ts src/hooks/useDataHealth.ts src/pages/admin/DataHealthPage.tsx src/App.tsx src/pages/DashboardLayout.tsx
git commit -m "Add admin Data health page"
```

---

### Task 13: Beta site

- [ ] **Step 1:** Ask the user before pushing. Then `git push origin beta`.
- [ ] **Step 2:** Wait for the Vercel beta deployment; if `pupik-sales-dashboard-beta.vercel.app` still points at the previous deployment, `vercel alias set <new deployment url> pupik-sales-dashboard-beta.vercel.app`.
- [ ] **Step 3:** Open `https://pupik-sales-dashboard-beta.vercel.app/admin/data-health` with the test login; confirm it matches the BETA data. Watch one daily summary (next working day 07:30) arrive.

---

### Task 14: Production go-live (only after the user approves)

- [ ] **Step 1:** User adds `RESEND_API_KEY` to production Supabase secrets.
- [ ] **Step 2:** Apply `data_health_tables` and `data_health_seed` migrations to production (`hzgpkkbqhmtwqhkcntcc`); verify as in Tasks 1–2.
- [ ] **Step 3:** Deploy `data-health-check` to production with secret `DATA_HEALTH_PAGE_URL` = `https://sales-dashboard-app-omega.vercel.app/admin/data-health` (user sets it in production secrets).
- [ ] **Step 4:** Promote the sync change (main PC):
  `powershell -ExecutionPolicy Bypass -File "\\srv\office\Biz-Dev\Projects\Codding\Management Dashboard\update\tools\promote.ps1" -Notes "Data health: sync records per-file observations"`
  User clicks **Apply dashboard update** on smartpupik; confirm `update\RESULT.json` = applied and production `source_file_observations` gets rows.
- [ ] **Step 5:** Production vault secrets (URL + production anon JWT) and `data_health_cron` migration on production.
- [ ] **Step 6:** Turn BETA's emails off to avoid duplicates: BETA `update data_health_settings set enabled = false;` (BETA keeps evaluating for testing).
- [ ] **Step 7:** Merge `beta` → `main` for the page (user approval), production deploy per `docs\APP.md`.
- [ ] **Step 8:** Update server docs: `docs\RUNBOOK.md` (data health section: page URL, emails, how to change a rule), `docs\PC-ROLES.md` (no new PC jobs), `HANDOFF.md`.
