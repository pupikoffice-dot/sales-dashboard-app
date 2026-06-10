# HANDOFF — sales-dashboard-app

## Current State
_Last updated: 2026-06-09 23:40:36 by Cursor_

**Status:** Active
**Phase:** Sales Clients Items Breakdown performance — deployed on Vercel main

- Works now: Pupik all-clients items breakdown Jan–May builds in ~9 seconds on Vercel (legacy parity); sections collapsed by default; minimize and expand all; per-table SKU and Item Name IN/OUT column filters; sort; individual section expand; prior sidebar, Oversite, i18n, and filter fixes remain on main
- In progress: Nothing active in app code
- Blocked: Nothing blocked
- Next up: Optional — verify Export All CSV on large client report; spot-check Cash summary and Items view with many clients; office PC data refresh if needed

---

## Session Log

### 2026-06-09 23:40:36 — Cursor
**Done:**
- Fixed Vercel Clients Items Breakdown freeze — pre-grouped client history and month indexes removed billions of row scans
- Added HTML fast path for large reports (15+ clients, items breakdown, months) matching legacy single-pass innerHTML strategy
- Reduced build time from ~2.5 minutes to ~9 seconds by eliminating per-batch React re-renders and repeated filter attachment
- Restored SKU and Item Name column IN/OUT filters on HTML client tables
- Fixed Expand All — synced global collapse state with DOM after build; stable filter deps prevent accidental HTML rebuild
- Verified on Vercel: clickable report, filters, minimize all, expand all for 384 clients
- Committed and pushed to main through 8b0f252

**Decisions:**
- Large client items reports use legacy-style HTML build plus one DOM insert, not per-client React tables
- Column filters attach once after full report HTML is in the DOM
- Default collapsed on large reports; globalCollapsed set true after build so Expand All button state matches sections

**Next:**
- User choice: Export All sanity check, other report modes, or office PC data push

---

### 2026-06-09 09:44:12 — Cursor
**Done:**
- Fixed year buttons to select or deselect all months for 2025 and 2026 with Clear in months filter
- Fixed Apply and Render resetting client and item selections to all
- Fixed Clear on client, category, and item filter lists using list epoch init so cleared state sticks; empty selection shows no report rows
- Single-company Oversite layout: inner section cards in three-column grid like legacy Pupik dashboard
- Oversite nav button clears applied sales report and shows Oversite home again for limited users
- Committed and pushed three deploys to main ending at eb344ae

**Decisions:**
- List init keyed by epoch on view or category change, not on user Clear
- Empty filter selection means no rows, matching legacy dashboard behavior
- showOversiteDashboard clears applied and rendering state without wiping sidebar filter choices

**Next:**
- Office PC: re-import VBA, run macro, push_to_github for live Monkeytime open orders and debt dates

---

### 2026-06-09 00:28:55 — Cursor
**Done:**
- Removed company names from dashboard header subtitle
- Oversite subheader shows file update hour from export generated timestamp plus month label
- Fixed open debt month columns showing Excel serial numbers; filtered debt header rows; open date from dashboardmeta B1 wired through export and UI
- Fixed Orders MTD using local date instead of UTC; legacy fallback when 722 rows mis-tagged as openorders
- Stock alerts: SKU before item name, client last-buy qty and SKU, velocity drop SKU and Base/Mo tooltip, Avg Days tooltip
- Updated VBA export and import macro for debt dates, debtLastUpdate, and 721mt sheet lookup; push script post-processes missing openorders-mt and debtLastUpdate
- Committed and pushed 57cf6a4 to main for Vercel deploy

**Decisions:**
- App-side debt month label fix as fallback until next Excel export; VBA formats headers at source going forward
- push_to_github injects 721mt from workbook or network source when VBA export omits them

**Next:**
- Re-import VBA on office PC and run macro plus push_to_github to populate Monkeytime open orders in live data

---

### 2026-06-08 17:46:28 — Cursor
**Done:**
- Fixed false Monkeytime 721 health banner for users without MT in scope
- Pushed fresh data_loader.js so Oversite Monkeytime 722 shows real numbers
- Added Apply & Render loading spinner on button plus main-area overlay while report builds
- Built Hebrew/English i18n with RTL layout, header toggle, and admin per-user language
- Pushed commits 929f294 and 18a4ce2 to main; user applied add_user_locale.sql in Supabase

**Decisions:**
- Lightweight custom i18n (no react-i18next); locale stored on dashboard_user_access with localStorage fallback
- Data-health checks gated by user company access list

**Next:**
- Populate 721mt in Excel export for Monkeytime open orders on Oversite

---

### 2026-06-08 07:54:24 — Cursor
**Done:**
- Set up dual-target shared package inside sales-dashboard-app so Vercel and legacy HTML share one source of sales logic
- Wired legacy group and pupik dashboards to dashboard-shared.js for sort and column filters
- Updated push script to build shared bundle and include it in GitHub Pages deploy
- Added dual-target protocol doc and Cursor rule
- Committed and pushed to main; Vercel deploy triggered

**Decisions:**
- Shared package lives in the React repo (not parent Dashboard folder) so Vercel builds succeed
- React keeps thin re-exports; legacy delegates to window.DashboardShared

**Next:**
- Run push_to_github.ps1 to publish legacy dashboards with the shared bundle

---

### 2026-06-08 07:38:55 — Cursor
**Done:**
- Implemented column inline filters on SKU, Item Name, and Price headers — legacy DOM attach pattern with IN/OUT toggle, ampersand AND terms, and tfoot totals from visible rows
- Wired filters via sales-report DOM setup alongside sticky headers
- User verified filters on item tables

**Decisions:**
- DOM-based filter attach (not React state) to match sort/sticky pattern and avoid re-render wiping filters

**Next:**
- User picks next priority — deploy, placeholder modules, or further polish

---

### 2026-06-08 06:38:49 — Cursor
**Done:**
- Fixed Apply & Render — aligned canApply with legacy rules, auto-fill selections on apply, navigate to Sales page, removed stale context memoization
- Implemented pie charts — status bar and per-table Chart buttons, doughnut/bar modal, CSV export
- Fixed chart modal blank screen — registered Chart.js controllers, portaled modal to document body
- Implemented sticky headers for monthly dual-month and stock tables — legacy fixed clone pattern; user verified on Months + Items breakdown
- Build passes after all changes

**Decisions:**
- Apply uses flushSync to init client/category/item selections before setting applied flag
- Chart modal renders via portal to avoid clipping and z-index issues
- Sticky headers hook runs inside sales-report after tables mount, with document capture scroll and IntersectionObserver

**Next:**
- Column inline filters in table headers

---

### 2026-06-07 19:26:23 — Cursor
**Done:**
- Fixed column sorting — replaced React state sort with legacy DOM sort (delegated click on sortable headers inside sales report)
- Sorting verified by user on Clients Items breakdown and related tables
- Build passes after sort refactor

**Decisions:**
- Use legacy DOM sortTable pattern instead of React row reordering — avoids re-render resetting order and matches original dashboard behavior

**Next:**
- Pie charts, sticky monthly headers, or column inline filters per user priority

---
