# HANDOFF — Mobile App for salesteam

## Current State
_Last updated: 2026-09-08 09:44:55 by Cursor_

**Status:** Active
**Phase:** ERP→Supabase sync running hourly; on-demand top-ups for Orders Today and Tsomet

- Works now: Hourly Google Drive → Supabase sync (`SalesAppSyncHourly`) for sales, orders, inventory, pricing, debt, receipts — recent runs all succeeded
- Works now: Targeted 722 orders sync (`sync_to_supabase.py --only-orders admin`) refreshes Orders Today in ~2 min without a full run
- Works now: Tsomet budget + segment sales sync (`sync_tsomet.py`) from the Z drive reports folder
- Works now: Goldbug and MT data paths from earlier sessions unchanged
- In progress: Nothing in IDE
- Blocked: Nothing blocked
- Next up: Consider auto-triggering the 722-only sync right after the ERP export lands, so Orders Today does not wait for the next hourly tick

---

## Session Log

### 2026-09-08 09:44:55 — Cursor
**Done:**
- Diagnosed stale Orders Today: ERP files and Drive both had the current day, but the hourly sync had already run before the export landed, so Supabase was days behind
- Ran the targeted 722 orders sync to close the gap, then verified today's rows and cash for Pupik and MT in Supabase
- Ran the 722 sync again on request the following day and confirmed both companies current
- Ran the Tsomet budget and segment sales sync after the user updated the sales file; report date came through as the prior day

**Decisions:**
- Treat the narrow 722-only sync as the standard fix when Orders Today lags, rather than forcing a full hourly run
- Root cause is timing between ERP export and the hourly tick, not a broken export or parser

**Next:**
- Decide whether to trigger the 722-only sync automatically after the ERP export completes

---

### 2026-08-30 18:47:49 — Cursor
**Done:**
- User added rep891gold and 722gold to Drive folder; ran full office sync to Supabase (~339k rows)
- Goldbug loaded: orders MTD, sales MTD, open orders, delivery notes, pricing, acc101 clients

**Decisions:**
- Skip Gold stock and 000 inventory sync for now

**Next:**
- Dashboard beta alias fixed separately; confirm Efi sees Goldbug KPIs after beta redeploy

---

### 2026-08-28 10:20:14 — Cursor
**Done:**
- Diagnosed missing Monkeytime stock cost — wrong rep907 column map (was reading col A as SKU; MT uses col B)
- Fixed parse_pricing for company mt: full column layout including cost in col I
- Applied Supabase migration so super_admin always gets cost and price in get_dashboard_aux
- Re-upserted MT pricing from Z drive REP907mt.xls (~13k rows; ALN-0049 cost 41.94 verified)

**Decisions:**
- MT rep907 is a distinct layout from Pupik/Grow/Gold — not just a different cost column
- One-off local re-sync used until next hourly cron picks up fixed parser from Dropbox

**Next:**
- User smoke-test Stock → Monkeytime on sales dashboard as super admin
- Optional cleanup of stale MT item_pricing rows with old numeric SKUs from bad parse

---

### 2026-07-01 15:43:04 — Claude Code
**Done:**
- Fixed Open Debt (everyone): three bugs: (a) old-debt column (D) dropped by parser — now captured; (b) stale accumulation (phantom Oct/Nov/Dec + inflated Jan–Apr) — loader is now idempotent (delete-by-company + insert fresh), self-cleans, won't recur; (c) RPC hardcoded oldDebt: 0 — now surfaces real old debt
- Result: pupik debt = ₪2,184,854 (matches file exactly); old ₪167,375 + Jan–Jun ₪2,017,479; phantom months gone; applies all companies
- Oversight page (super-admin): spelling "Oversite" → "Oversight" (EN); added per-segment sync times under each table title (Orders/Open Orders/Sales/Returns/Debt) showing last ERP file sync
- Keyset pagination fix to data loader: switched OFFSET (re-scans ~8K rows per page, got 45s) to cursor paging via get_dashboard_sales_after (id > cursor, PK seek, all pages ~0.9s). Expected 8–10s load now

**Decisions:**
- Debt delete-by-company is safe (full current file = ground truth; stale data always wrong). Old debt stored as note='old', bucket 1900-01-01 for RPC filtering

**Next:**
- Debt load is production; Oversight + keyset paging deploy at 2276dff on Vercel. Browser refresh shows both.

---

### 2026-07-01 11:35:55 — Claude Code
**Done:**
- Hourly sync: registered Windows Task Scheduler task 'SalesAppSyncHourly' running C:\Python314\pythonw.exe sync_to_supabase.py cron every hour (no console window, survives GUI-app closure). Verified it launches and creates a 'cron' sync_logs run
- Added a concurrency guard to run_sync: if a sync started < 30 min ago is still 'running', the new run skips — permanently prevents overlapping triggers from double-loading/re-duplicating scopes
- Set the DesktopDashboard "Mobile App- Sync" step interval to 60 min (applies on next app restart; the Windows task covers hourly meanwhile)

**Decisions:**
- Windows Task Scheduler is the reliable hourly mechanism (per plan Phase 2); DesktopDashboard step kept as a guard-protected redundant trigger
- pythonw + WorkingDirectory set so .env loads and no window flashes hourly

---
