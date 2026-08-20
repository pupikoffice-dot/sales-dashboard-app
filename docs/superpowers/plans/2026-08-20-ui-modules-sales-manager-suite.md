# UI Modules + Sales Manager Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the `beta` branch only, ship UI-module catalog + class grants, and the Sales Manager Oversight **suite** (All + per-agent translucent 4+2 cubes, goals from Excel→Supabase), without changing production `main` behavior.

**Architecture:** Additive Supabase tables for UI modules and agent targets. Beta frontend reads class grants for `ui.oversight.suite.*` / `ui.oversight.addon.*` and routes `OversitePage` to either the suite or classic layout. **CORE RULE:** Oversight and Sidebar never drive each other’s UI (same data + class restrictions only). Goals synced by office ETL from `Z:\Biz-Dev\Data\salesagentstargets26.xlsx`.

**Tech Stack:** React + Vite, TanStack Query, Supabase (Postgres + JS client), Vitest, existing `oversiteMetrics` / Oversight components, Python ETL (`sync_to_supabase.py`).

**Spec:** `docs/superpowers/specs/2026-08-20-ui-modules-sales-manager-suite-design.md`

**Channel:** `beta` branch + `pupik-sales-dashboard-beta.vercel.app` only. Never merge to `main` in this plan.

---

## File map

| Path | Responsibility |
|------|----------------|
| `Mobile App for salesteam/supabase/migrations/YYYYMMDD_ui_modules_and_targets.sql` | Tables `app_ui_module`, `sales_agent_targets`; seed `sales_manager`; RLS |
| `Mobile App for salesteam/sync/sync_agent_targets.py` (or section in `sync_to_supabase.py`) | Excel → `sales_agent_targets` upsert |
| `src/types/uiModules.ts` | Types for catalog + resolved suite/addon |
| `src/lib/uiModules.ts` | Resolve grants, agent list, company aggregation helpers |
| `src/lib/uiModules.test.ts` | Unit tests for resolve + agent sort + goal sum |
| `src/lib/permissionsApi.ts` | Fetch UI modules / class UI grants / targets |
| `src/hooks/useUiModules.ts` | Query: catalog + current user’s suite/addons |
| `src/hooks/useSalesAgentTargets.ts` | Query current-month targets |
| `src/hooks/useResolvedOversightMode.ts` | Thin resolve wrapper for OversitePage |
| `src/components/oversite/salesManager/SalesManagerSuite.tsx` | Suite page shell (All + agent windows) |
| `src/components/oversite/salesManager/SmAgentWindow.tsx` | One window (header + cube grid) |
| `src/components/oversite/salesManager/SmCubeGrid.tsx` | Responsive 4+2 / mobile stack |
| `src/components/oversite/salesManager/smMetrics.ts` | Pure KPI builders scoped by agents+companies |
| `src/components/oversite/salesManager/smMetrics.test.ts` | Metric tests |
| `src/pages/OversitePage.tsx` | Branch: suite vs classic; honor CORE RULE |
| `src/pages/admin/ClassesPage.tsx` + `PermissionSections.tsx` | Grant UI modules; ≤1 suite validation |
| `src/styles/legacy-theme.css` | `.sm-cube`, `.sm-window`, responsive grid |
| `src/i18n/en.ts`, `he.ts` | Suite labels |

---

### Task 1: Migration — UI module catalog + targets table

**Files:**
- Create: `Mobile App for salesteam/supabase/migrations/20260820190000_ui_modules_and_sales_agent_targets.sql`

- [ ] **Step 1: Write migration SQL**

```sql
-- app_ui_module catalog
create table if not exists public.app_ui_module (
  id text primary key,
  label text not null,
  surface text not null check (surface in ('oversight', 'sidebar')),
  kind text not null check (kind in ('suite', 'addon')),
  active boolean not null default true,
  sort_order int not null default 100,
  description text
);

alter table public.app_ui_module enable row level security;
create policy app_ui_module_select on public.app_ui_module
  for select to authenticated using (true);
create policy app_ui_module_write on public.app_ui_module
  for all to authenticated using (is_super_admin()) with check (is_super_admin());

insert into public.app_ui_module (id, label, surface, kind, sort_order, description) values
  ('sales_manager', 'Sales Manager Module', 'oversight', 'suite', 10,
   'Replaces classic Oversight with All + per-agent KPI cubes.')
on conflict (id) do update set label = excluded.label, kind = excluded.kind, surface = excluded.surface;

-- Optional: register permission nodes for grants (if app_node is used for UI)
-- Prefer class grants: kind=node, key=ui.oversight.suite.sales_manager, value=null

create table if not exists public.sales_agent_targets (
  agent_erp_id text not null,
  year int not null,
  month int not null check (month between 1 and 12),
  target_cash numeric not null default 0,
  updated_at timestamptz not null default now(),
  primary key (agent_erp_id, year, month)
);

alter table public.sales_agent_targets enable row level security;
create policy sales_agent_targets_select on public.sales_agent_targets
  for select to authenticated using (true);
create policy sales_agent_targets_write on public.sales_agent_targets
  for all to authenticated using (is_super_admin()) with check (is_super_admin());
-- ETL uses service role (bypasses RLS)
```

- [ ] **Step 2: Apply migration** to project `hzgpkkbqhmtwqhkcntcc` via Supabase MCP/`apply_migration` or SQL editor.

- [ ] **Step 3: Commit migration file** (from the folder that tracks migrations; if outside `sales-dashboard-app` git, note path in HANDOFF — app repo commit can reference only).

```bash
# If migrations live outside app repo, skip git here; otherwise:
git add "../Mobile App for salesteam/supabase/migrations/20260820190000_ui_modules_and_sales_agent_targets.sql"
git commit -m "Add app_ui_module catalog and sales_agent_targets tables."
```

---

### Task 2: Goals ETL from Excel

**Files:**
- Create or extend: `Mobile App for salesteam/sync/sync_agent_targets.py`
- Modify: `Mobile App for salesteam/sync/sync_to_supabase.py` (call hook) or a small `.bat`

- [ ] **Step 1: Implement reader + upsert**

Read `Z:\Biz-Dev\Data\salesagentstargets26.xlsx` Sheet1: row1 months 1–12, col A agent. Upsert into `sales_agent_targets` for year=2026. Skip blank agents. Use service role from existing `.env`.

- [ ] **Step 2: Run once manually** and verify rows in Supabase for agents 24/25/27 current month.

- [ ] **Step 3: Document schedule** in HANDOFF / script header (daily or with hourly sync). Commit sync script.

---

### Task 3: Resolve UI modules (pure logic + tests)

**Files:**
- Create: `src/types/uiModules.ts`
- Create: `src/lib/uiModules.ts`
- Create: `src/lib/uiModules.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { pickOversightMode, sortAgentIds, sumGoals } from './uiModules'

describe('pickOversightMode', () => {
  it('returns suite when class has an oversight suite', () => {
    expect(pickOversightMode([{ id: 'sales_manager', surface: 'oversight', kind: 'suite' }])).toEqual({
      mode: 'suite', suiteId: 'sales_manager',
    })
  })
  it('ignores addons when suite present', () => {
    expect(pickOversightMode([
      { id: 'sales_manager', surface: 'oversight', kind: 'suite' },
      { id: 'something', surface: 'oversight', kind: 'addon' },
    ]).mode).toBe('suite')
  })
  it('returns classic with addons when no suite', () => {
    expect(pickOversightMode([{ id: 'x', surface: 'oversight', kind: 'addon' }])).toEqual({
      mode: 'classic', addonIds: ['x'],
    })
  })
})

describe('sortAgentIds', () => {
  it('sorts numeric-ish agent codes ascending', () => {
    expect(sortAgentIds(['27', '9', '24'])).toEqual(['9', '24', '27'])
  })
})

describe('sumGoals', () => {
  it('sums targets; missing treated as 0', () => {
    expect(sumGoals(['24', '25'], { '24': 100, '25': undefined })).toBe(100)
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx vitest run src/lib/uiModules.test.ts
```

- [ ] **Step 3: Implement `uiModules.ts` minimally until PASS**

- [ ] **Step 4: Commit**

```bash
git add src/types/uiModules.ts src/lib/uiModules.ts src/lib/uiModules.test.ts
git commit -m "Add UI module resolve helpers with tests."
```

---

### Task 4: Fetch grants + targets (API hooks)

**Files:**
- Modify: `src/lib/permissionsApi.ts`
- Create: `src/hooks/useUiModules.ts`
- Create: `src/hooks/useSalesAgentTargets.ts`

- [ ] **Step 1: Add fetchers**

`fetchUiModules()`, `fetchUserUiModules(userId)` — join `app_user_class` → class grants where `kind='node'` and `key` like `ui.oversight.%`, map to catalog rows.  
`fetchSalesAgentTargets(year, month)`.

- [ ] **Step 2: Hooks wrap with react-query**; honour View-as target user id from `PreviewContext` / access user.

- [ ] **Step 3: Smoke in browser on beta build** (after later tasks) — for now unit-test key mapping if pure.

- [ ] **Step 4: Commit**

```bash
git commit -m "Fetch UI modules and sales agent targets for beta suite."
```

---

### Task 5: CORE RULE on OversitePage (no suite UI yet)

**Files:**
- Modify: `src/pages/OversitePage.tsx`

- [ ] **Step 1: Stop hijacking `/oversite` with SalesReportBody**

Current (lines ~70–72):

```ts
if (!isSuperAdmin && f.applied) {
  return <SalesReportBody />
}
```

Remove this branch. **CORE RULE:** `/oversite` always shows Oversight layout. Sidebar Apply must navigate to enquiry routes (already done for many flows in `SidebarFilters`) — never replace Oversight content.

- [ ] **Step 2: Manual check** — open `/oversite`, set filters, Apply → still on Oversight (classic) until suite ships; report lives on `/sales` etc.

- [ ] **Step 3: Commit**

```bash
git commit -m "Keep Oversight route independent of sidebar Apply."
```

---

### Task 6: Suite metrics helpers

**Files:**
- Create: `src/components/oversite/salesManager/smMetrics.ts`
- Create: `src/components/oversite/salesManager/smMetrics.test.ts`

- [ ] **Step 1: Failing tests** for aggregating MTD/open orders/returns/debt/orders-7d/receipts across **`access.companies` + agent scope only** — never `DashboardFilters` / Apply / selected company from sidebar (CORE RULE).

Include at least:

```ts
it('aggregates sales MTD across all allowed companies for scoped agents', () => { /* ... */ })
it('does not read sidebar filter company when building suite KPIs', () => { /* ... */ })
```

- [ ] **Step 2: Implement** using `oversiteMetrics` primitives on rows already filtered by companies+agents. Receipts: **do not** use hardcoded `RECEIPTS_TEAM_AGENTS` — scope to suite agent set ∩ allowed companies.

- [ ] **Step 3: Commit**

```bash
git commit -m "Add Sales Manager suite metric builders."
```

---

### Task 7: Suite UI — windows + translucent 4+2 cubes

**Files:**
- Create: `SalesManagerSuite.tsx`, `SmAgentWindow.tsx`, `SmCubeGrid.tsx`
- Modify: `src/styles/legacy-theme.css`
- Modify: `src/i18n/en.ts`, `he.ts`

- [ ] **Step 1: Implement cube grid CSS** — `.sm-cube` translucent; desktop 4+2; `&lt;900px` stack per spec.

- [ ] **Step 2: `SmAgentWindow`** — title + `SmCubeGrid` wired to metrics + goal. **Missing per-agent goal → display `—`** (not `0`). All-window goal still uses sum with missing treated as 0 in the total (per spec).

- [ ] **Step 3: `SalesManagerSuite`** — All window then sorted agent windows; wire data hooks from Task 4.

- [ ] **Step 4: Orders cube** — embed/reuse `OversiteOrdersLast7Days` + report button patterns scoped to agents.

- [ ] **Step 5: Visual check** on desktop + narrow viewport.

- [ ] **Step 6: Commit**

```bash
git commit -m "Build Sales Manager suite UI with responsive cube grid."
```

---

### Task 8: Wire suite into OversitePage

**Files:**
- Modify: `src/pages/OversitePage.tsx`
- Create if missing: `src/hooks/useResolvedOversightMode.ts` (thin wrapper over Task 3+4)

- [ ] **Step 1: Add hook** `useResolvedOversightMode()` returning `{ mode, suiteId, addonIds }` from catalog + class grants.

- [ ] **Step 2: Branch render** (only after Task 7 exists so typecheck stays green):

```tsx
const { mode, suiteId } = useResolvedOversightMode()
if (mode === 'suite' && suiteId === 'sales_manager') {
  return <SalesManagerSuite />
}
// else classic OversitePage body as today
```

- [ ] **Step 3: Manual check** — with suite grant, suite shows; without, classic.

- [ ] **Step 4: Commit**

```bash
git commit -m "Route Oversight to Sales Manager suite when class grants it."
```

---

### Task 9: Classes admin — grant UI modules

**Files:**
- Modify: `src/components/admin/PermissionSections.tsx`
- Modify: `src/pages/admin/ClassesPage.tsx` (save path already diffs grants)
- Possibly: small `UiModulesSection` under Pages & Widgets

- [ ] **Step 1: UI** — list active `app_ui_module` rows; checkboxes write `node`/`ui.oversight.suite.<id>` or `ui.oversight.addon.<id>`.

- [ ] **Step 2: Validation** — on save, if &gt;1 oversight suite checked, block with message.

- [ ] **Step 3: Note in UI** — “If a suite is set, addons are ignored.”

- [ ] **Step 4: Assign `sales_manager` to Sales Manager class** in beta for kfir (manual or seed grant SQL).

- [ ] **Step 5: Commit**

```bash
git commit -m "Allow Classes to grant Oversight UI modules (suite/addon)."
```

---

### Task 10: Beta deploy + verify

**Files:** none (ops)

- [ ] **Step 1:** `git push origin beta`

- [ ] **Step 2:** `npx vercel deploy` from app dir; alias to `pupik-sales-dashboard-beta.vercel.app`

- [ ] **Step 3:** Verify as Sales Manager user: suite layout, All + agents, goals (`—` when missing), receipts, Apply does not kill Oversight.

- [ ] **Step 4:** Verify production `main` URL still classic (no suite code).

- [ ] **Step 5:** Update `Dashboard/HANDOFF.md` Current State (UI modules on beta; CORE RULE).

---

## Testing checklist (manual)

- [ ] Suite user → only Sales Manager Oversight  
- [ ] Non-suite → classic Oversight  
- [ ] Empty agent scope → all agents in company access  
- [ ] Goals match Excel for current month after ETL  
- [ ] Mobile: Orders full-width readable  
- [ ] Production unchanged  

## Out of scope (do not implement in this plan)

- Merge/promote to `main`  
- Phase 3 full permission RPC cutover  
- Sidebar-surface UI modules  
- Addon examples other than suite infrastructure  

---

## Execution handoff

After plan review approval, choose:

1. **Subagent-Driven** — fresh subagent per task (@subagent-driven-development)  
2. **Inline Execution** — this session (@executing-plans)
