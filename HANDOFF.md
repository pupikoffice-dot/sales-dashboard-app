# HANDOFF — sales-dashboard-app

## Current State
_Last updated: 2026-08-21 20:45:29 by Cursor_

**Status:** Active
**Phase:** UI modules + Sales Manager suite on beta (product line **2.0**)

- Works now: Beta title badge **2.0 · beta**; production live DB `active_version` (**1.0** until promote)
- Works now: Sales Manager suite — **company-first** (each access company block → All → agents); **never combine** companies; Oversight ⊥ Sidebar; goals agent-level; receipts; Classes suite grants
- Works now: Classic Oversight on production `main`
- In progress: Manual verify / iterate on beta 2.0
- Blocked: Nothing blocked
- Next up: Keep Phase 3 / promote-to-main off until asked

### CORE RULES (suite)

1. **Oversight ⊥ Sidebar** — filters/Apply never change Oversight; Oversight never changes sidebar.
2. **Companies never combined** — multi-company users see company blocks one after another (company → All → agents → next company). Never sum KPIs/charts/receipts/reports across companies. Goals stay agent-level.

### Version vs channel (locked)

| Concept | Meaning | Today |
|--------|---------|--------|
| **Version** | Product release line (`1.0`, `2.0`, `2.1`…) | Production live = **1.0** (DB). Beta work line = **2.0** |
| **Channel** | Where you iterate: production (stable) vs **beta** (next work) | `main` / prod URL vs `beta` / `pupik-sales-dashboard-beta.vercel.app` |

- **Beta** = working iteration of the next (or in-progress) version. Title: `{productVersion} · beta`.
- **Production** = stable live. Title: DB `app_runtime_config.active_version` only.
- Do **not** change DB `active_version` just to relabel beta — that row is the shared live cutover flag.
- After promote of 2.0: set DB to `2.0`; set `BETA_PRODUCT_VERSION` / `VITE_PRODUCT_VERSION` to `2.1` or `3.0` for the next beta.

Code: `src/lib/appChannel.ts`

---

## Phase 2 — Server-filtered cost/price data (not implemented)

Phase 1 hides Cost, Total Cost, Price, and cost-based charts in the UI only. The browser still downloads full `data.json` including `costRows` and `priceRows` from rep907. A technical user could read those in DevTools.

**Follow-up:** Edge function or split data bundles so users without `show_item_cost` never receive `costRows`, and users without `show_client_profit` never receive `priceRows`. CSV/XLS exports must respect the same flags. Add calculated profit/margin columns gated by `show_client_profit`.

---

## Session Log

### 2026-08-21 20:45:29 — Cursor
**Done:**
- Suite CORE RULE: companies never combined — company-first layout (company → All → agents → next company)
- KPIs/reports scoped to one company per block; design spec + HANDOFF updated

**Decisions:**
- Layout B: company outer, then All + agents under each
- Goals remain agent-level (not split by company)

**Next:**
- Verify multi-company Sales Manager on beta (e.g. kfir)

---

### 2026-08-21 20:36:50 — Cursor
**Done:**
- Header badge: beta shows product version + channel (`2.0 · beta`); production shows live DB `active_version` only
- Documented version vs channel model in HANDOFF and `appChannel.ts`

**Decisions:**
- Version = release line; beta = iteration channel for the next/in-progress version
- Do not flip DB `active_version` to relabel beta titles

**Next:**
- Continue beta 2.0 work; on promote set DB to 2.0 and bump beta product version

---

### 2026-08-20 20:27:13 — Cursor
**Done:**
- Shipped UI modules + Sales Manager suite on beta (merge `feature/ui-modules-sales-manager` → `beta` @ `1dab788`)
- DB: `app_ui_module` + `sales_agent_targets`; seeded Sales Manager class suite grant; goals ETL from Excel into hourly sync
- CORE RULE: Oversight route independent of sidebar Apply; suite KPIs use access companies/agents only
- Classes admin can grant oversight suite/addon (≤1 suite; no per-user suite override)
- Deployed and aliased https://pupik-sales-dashboard-beta.vercel.app

**Decisions:**
- kind is suite|addon (not widget); suite replaces classic Oversight; addons ignored while suite present
- Stay on beta only — do not promote to main / Phase 3 until explicit ask

**Next:**
- Manual verify suite as Sales Manager on beta; production stays classic

---

### 2026-08-05 13:59:25 — Cursor
**Done:**
- Diagnosed empty Orders Today despite fresh 722 pupik file: React reads Supabase; hourly Drive to Supabase sync had not yet loaded todays rows; ran targeted 722 sync so today appeared
- Gave multi-company Oversite / Orders MTD distinct accents (Pupik indigo, Monkeytime sky); pushed b6fbf32

**Decisions:**
- Accent styling applies only when 2+ companies are visible
- Recommended prevention for Orders Today lag: post-export 722-only sync (not implemented yet)

**Next:**
- Optional wire post-export 722 sync; optional Phase 2 cost/price server filter

---

### 2026-07-23 07:58:36 — Cursor
**Done:**
- Added Oversight stacked chart for orders cash over last 7 days under Orders Today; pushed a4a98b2
- Diagnosed missing 22 Jul bar: Supabase already had 722 pupik cash; brittle date string equality and orders-tag fallback for small agent scopes could wipe day charts
- Hardened: normalizeSalesDate on load; Orders Today/MTD/7-day chart use normalized dates; resolveOrdersTag prefers orders-* if any rows exist
- Chart now skips Fri/Sat (last 7 workdays) and labels days as dd/mm + Sun/Mon-style abbr; pushed 875e845

**Decisions:**
- Israel work week for this chart: exclude Friday and Saturday
- Prefer durable date normalization at load over chart-only fixes

**Next:**
- Hard-refresh live app and confirm 22 Jul workday bar matches Excel 722pupik

---

### 2026-06-21 19:02:20 — Cursor
**Done:**
- Open Debt Full Report: grouped tables per agent, agent filter with search, sort on every column
- Added collapsible agent sections (click header to expand/collapse)
- Added PDF export for full report and per-agent table; fixed pop-up blocked error by using hidden iframe print instead of new window
- Pushed to GitHub main: 10dc863, e62f792, 321fe8e; Vercel production auto-deploy confirmed READY

**Decisions:**
- PDF export uses browser print dialog (Save as PDF) — no jspdf dependency; Hebrew client names via RTL print HTML
- User declined implementing 722pupik always-refresh pipeline fix for now

**Next:**
- Hard refresh live app and confirm PDF export opens print dialog without pop-up block

---

### 2026-06-14 12:55:14 — Cursor
**Done:**
- Restyled Admin Add user and Edit access dialogs to match dashboard dark modal theme
- Deployed to main at e7051ef
- Researched where item costs and client price/profit appear in app and legacy HTML
- Wrote implementation plan for per-user toggles: show item cost and show client profit and price
- Confirmed phase one is UI hide only; server-filtered costRows and priceRows deferred to phase two

**Decisions:**
- Item cost gates rep907 purchase cost in Stock view columns, total cost KPI, and cost-based pie
- Client profit gates catalog Price now and calculated profit or margin when added later
- Cash revenue stays visible; deny-by-default for new users; super admin always sees all

**Next:**
- Run Supabase migration and implement plan starting with Edit Access checkboxes and Stock view gating

---

### 2026-06-11 19:04:48 — Cursor
**Done:**
- Pushed Sales MTD stacked bar and delivery notes dropdown to main at 0ed4eef
- User reported delivery note data zero after export and push — root cause was wrong 720 column mapping in export pipeline, not React
- Fixed export column layout and always-refresh 720 inject in parent Dashboard run_export.ps1 and ExportDashboardData.bas
- User re-ran export, push_to_github, and confirmed done

**Decisions:**
- Delivery MTD KPIs depend on date field in delivery720 export rows — UI filter is correct once data has YYYY-MM-DD dates
- Export always re-injects 720 from workbook sheets until embedded VBA is manually updated

**Next:**
- Browser verify stacked Sales MTD bar and delivery notes section on live Vercel app

---

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
