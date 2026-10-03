# Data Health Monitor — design

Date: 2026-10-03. Status: approved in conversation, pending written-spec review.

## Goal
Know at all times whether every ERP/Excel file the Management Dashboard loads is up to date, get an email when one
is not (with what to run to fix it), and keep a history so stale periods, fix times and recurring failures can be
traced over time.

## Context
- Production (OMEGA, Supabase `hzgpkkbqhmtwqhkcntcc`) is fed by smartpupik: ERP exports write `.xls` files to
  `\\srv\office\Biz-Dev\Data`; the sync (`Management Dashboard\sync\sync_to_supabase.py`) loads them hourly at :20
  and after the P1 / Rep722 procedures. BETA (`qwtfsnkabvbxurwduvyn`) is fed the same way from the main PC.
- Code changes reach smartpupik only through the release process (`Management Dashboard\docs\RELEASE.md`):
  edit `beta\`, test on BETA, Promote, Apply.
- Failures seen so far that this must catch: an export job silently not writing its file; grow exports stopped for
  months; a sync interrupted mid-run leaving `722mt` half loaded (23,500 of 38,610 rows); a sync row stuck at
  `running`; smartpupik not running at all.

## Approach
The sync reports what it saw; the database judges and notifies.
1. Each sync run records one observation per file it considered (name, modified time, size, rows loaded).
2. A Supabase edge function, started every 30 minutes by `pg_cron`, compares the latest observations with per-file
   rules, opens/closes incidents, and sends email through Resend.
3. An admin page in the web app shows current status and history.

Because judging happens in the cloud, alerts still fire when both PCs are off (observations stop advancing, so
files go stale and the sync-health check fires).

## 1. What is checked

Time zone `Asia/Jerusalem`. **Working days Sun–Fri; Saturday is never alerted.**

| Group | Files (company) | Produced by | Rule |
|---|---|---|---|
| `p1` | 720, 721, rep891 (pupik, mt, gold); collectyear008 (pupik, mt) | smartpupik P1, every 90 min 08:00–20:00 | red if older than **4 h**, evaluated 10:00–21:00 working days |
| `rep722` | 722 (pupik, mt) | smartpupik Rep722, hourly 09:00–18:00 | red if older than **3 h**, evaluated 11:00–19:00 working days |
| `wms` | 000 (pupik, mt) | smartpupik Copy WMS (copies only when the source changes) | red if older than **30 h**, working days |
| `nightly_aski` | rep893 (pupik, mt) | ERP user `aski`'s nightly batch (~03:36), not ours | red if not modified since 00:00 today, evaluated from 04:30 on working days |
| `manual_sales` | 854 (PUP, MT, grow), 855 (PUP, MT), 887 (pupik, gold), 888 (pupik, mt, gold) | manual: `\\srv\findat\batch\REP855&854ALL.BAT`; BDS BAT on the main PC Task app | red after **7 days** |
| `manual_ref` | REP907 (pupik, mt, grow, gold), item103 (mt, grow) | manual reports | red after **14 days** |
| `manual_clients` | acc101 (pupik, mt, grow, gold) | unknown owner (to be identified) | red after **30 days** |
| `debt` | `Debt clients.xlsm` | user's workbook, copied to Data by the main PC Task app | red after **7 days** |
| `tsomet` | `\\srv\office\Biz-Dev\Reports\tsomet\budget.xlsx`, `...\Segment reports DATA\sales.xlsx` | main PC segment report | red after **7 days** |
| `known_broken` | 721grow, rep891grow, collectyear008grow, 722gold | no running job today (grow exports stopped; 722gold since 2026-08-28) | red after **2 days** (acknowledged at go-live, see below) |
| `frozen` | rep891*2025, collectyear008 * 2024, salesagentstargets26.xlsx | historical / yearly | listed, never red |

Notes:
- Amber = past 75 % of the limit (shown on the page and in the summary; no email).
- Files produced by P1 but not loaded by the sync (723*, 906*) are **not** monitored.
- **Known-broken at go-live** (incidents created already *acknowledged*, so no repeated emails, still red on the page):
  the `known_broken` group and acc101 mt/grow/gold (since April). When one is fixed it turns green and its incident
  closes normally; it can then be moved to its proper group.
- `processed` means the sync loaded data from the file in that run. `Debt*.xls` (opened, then skipped because debt
  comes from `Debt clients.xlsm`) and all `SKIP` files are `processed=false`.
- A file with `processed=true` and no rule is reported as `unruled` in the daily summary. Unprocessed files without a
  rule are ignored.

**Content check** (every file with a rule, except `frozen`): red if a run loaded **0 rows** where the previous
successful run loaded > 0, or **< 70 %** of the median rows of its last 10 successful runs. (Would have caught the
`722mt` half load.)

**Sync health:**
- red if no `sync_logs` row with `status='success'` started in the last **2 h**, evaluated 08:00–22:00 working days;
- red if a `running` row is older than **45 min** and no later `success` row exists. A `running` row superseded by a
  later success is ignored (existing leftovers from 2026-10-02 18:51 and 2026-10-03 11:45 stay as they are).

## 2. Components and data

### Tables (production and BETA, via migrations in `supabase/migrations/`)
- **`source_files`** — the rules. One row per monitored file: `file_name` (unique, as on disk), `company`,
  `group`, `producer`, `fix_hint` (exact thing to run / who to ask), `impact` (what it affects on the dashboard),
  `max_age_hours`, `rule_kind` (`age` | `nightly` | `frozen`), `eval_from`/`eval_to` (local time window, null = all
  day), `active` (bool). Seeded with the files in section 1.
- **`source_file_observations`** — `id`, `observed_at`, `sync_log_id`, `host`, `file_name`, `modified_at`,
  `size_bytes`, `rows_loaded` (null if the file was not loaded in this run), `processed` (bool). One row per file per
  sync run (~700/day). Rows older than 365 days are deleted by the checker.
- **`data_health_incidents`** — `id`, `check_key` (file name, or `sync:no_success` / `sync:stuck` / `rows:<file>`),
  `opened_at`, `closed_at`, `severity` (`red`), `reason` (text shown in emails), `acknowledged_at`,
  `last_notified_at`, `notes`.
- **`data_health_settings`** — single row: `recipients` (text[]), `from_address`, `summary_time` (default 07:30),
  `enabled` (bool).

RLS: all four readable by super-admins only; written only by the service role (sync, edge function). Acknowledge
and notes are written through an RPC restricted to super-admins.

### Sync change (`beta\sync\sync_to_supabase.py`, released to smartpupik by Promote/Apply)
- During a full run, count rows loaded per file (existing per-file load paths: sales types, receipts/collectyear,
  rep893, debt workbook, tsomet, pricing, item catalog, clients).
- At the end of the run (success or failure), insert one `source_file_observations` row for every `.xls/.xlsx/.xlsm`
  in the data folder plus the two tsomet files, with `processed` and `rows_loaded`.
- Orders-only runs (`--only-orders`) record observations for the 722 files only.
- A failure to write observations must not fail the sync (log a warning).

### Edge function `data-health-check` (Deno, `supabase/functions/data-health-check/`)
- Started by `pg_cron` every 30 min, 07:00–22:00 Sun–Fri local, and once at the configured summary time.
- Evaluation is a pure function `evaluate(rules, latestObservations, rowHistory, syncLogs, now) -> statuses`
  (unit-tested), followed by incident bookkeeping:
  - status turns red and no open incident → open incident, send **alert** email;
  - incident open, not acknowledged, last email > 24 h ago → send **reminder**;
  - status back to green/amber → close incident, send **resolved** email (states how long it was open).
- At summary time: one **daily summary** email with every group, file, age, status, open incidents, `unruled`
  files and overnight events.
- Email via the Resend HTTP API; key in Supabase secret `RESEND_API_KEY`. If sending fails, the incident's
  `last_notified_at` is not updated, so the next run retries.
- `enabled=false` in settings stops emails but not evaluation (for BETA testing / maintenance).

### Web page `/admin/data-health` (super-admin only)
- Status grid grouped by `group`: file, company, age, status colour, producer, fix hint, impact.
- Open incidents on top, with Acknowledge and a notes field.
- Per-file timeline (30 / 90 days): green/red bands from observations and incidents.
- Monthly totals: incidents per group, average time to fix.
- Reads through RPCs; route added next to `admin/classes` / `admin/modules` in `App.tsx`.

## 3. Email content
- **Alert:** subject `[Dashboard data] RED: 855PUP.xls is 9 days old`. Body: what is wrong, since when, impact,
  fix hint, link to `/admin/data-health`.
- **Resolved:** subject `[Dashboard data] OK again: 855PUP.xls (was red 2 d 4 h)`.
- **Daily summary:** subject `[Dashboard data] Daily status Sun 04-Oct: 2 red, 1 amber, 41 green`.
- Recipients and sender come from `data_health_settings`. Sender starts as Resend's test sender
  (`onboarding@resend.dev`) until the user verifies a domain.

## 4. Rollout and testing
1. Migrations (tables, RLS, RPCs, seed rules) applied to **BETA**.
2. Sync change in `beta\`; BETA's hourly sync on the main PC fills observations. Check row counts per file match the
   sync log.
3. Edge function deployed to BETA with recipients = the user only; unit tests for `evaluate` (age, window,
   Saturday, nightly, rows check, sync health, acknowledged, superseded `running`). Force a red by setting one rule's
   `max_age_hours` to 0.1 on BETA, confirm alert → resolved emails, then restore it.
4. Page on the beta site, checked with the test login.
5. Production: same migrations, function and page deploy; Promote the sync change; user clicks Apply on smartpupik.
   First daily summary reviewed with the user.

## One-time user actions
- Create a Resend account, create an API key, paste it into Supabase secrets for BETA and production (guided).
- Confirm the recipient email address(es).
- Later: identify who produces acc101 and fill `fix_hint`.

## Out of scope
- Running the fix automatically (the email says what to run; a person runs it).
- Monitoring files the sync does not load.
- Telegram / WhatsApp / SMS.
