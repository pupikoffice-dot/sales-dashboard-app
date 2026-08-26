# BI Modules + Admin Modules Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `beta` only, ship Admin → Modules (UI + BI catalog, habit X/Y), per-user BI grants, and three BI cubes inside the Sales Manager suite (Missed items, Missed clients, Items sold by others) with BI badge.

**Architecture:** Additive Supabase tables for BI catalog, shared habit config, and per-user grants. Suite reads grants (super-admin = all active; View-as = target grants) and renders BI cubes after KPI cubes. Habit math is pure client-side over loaded `rows` + WMS stock. CORE RULES unchanged (Oversight ⊥ Sidebar; companies never combined).

**Tech Stack:** React + Vite, TanStack Query, Supabase, Vitest, existing suite (`SalesManagerSuite`, `smMetrics`), `DashboardLayout` admin nav.

**Spec:** `docs/superpowers/specs/2026-08-23-bi-modules-admin-modules-design.md`

**Channel:** `beta` branch + `pupik-sales-dashboard-beta.vercel.app` only. Never merge to `main` in this plan.

---

## File map

| Path | Responsibility |
|------|----------------|
| `Mobile App for salesteam/supabase/migrations/20260823190000_bi_modules.sql` | `app_bi_module`, `app_bi_config`, `dashboard_user_bi`; seed; RLS |
| `src/types/biModules.ts` | Catalog, config, grant types; `BiModuleId` |
| `src/lib/biModules.ts` | Resolve visible BI ids; habit window helpers; validate X/Y |
| `src/lib/biModules.test.ts` | Resolve + validate tests |
| `src/lib/biMetrics.ts` | Pure: missed items, missed clients, items sold by others |
| `src/lib/biMetrics.test.ts` | Habit / stock skip / others MTD tests |
| `src/lib/biModulesApi.ts` | Fetch catalog, config, user grants; upsert config/grants |
| `src/hooks/useBiModules.ts` | Catalog + config queries |
| `src/hooks/useBiUserGrants.ts` | Current (or preview) user grant set |
| `src/pages/admin/ModulesPage.tsx` | Admin → Modules UI |
| `src/pages/admin/UsersPage.tsx` | BI grant checkboxes |
| `src/pages/DashboardLayout.tsx` + `App.tsx` | Nav + route `/admin/modules` |
| `src/components/oversite/salesManager/bi/*` | `BiCube`, list cubes, wire into Alone/Vs |
| `src/components/oversite/salesManager/SalesManagerSuite.tsx` | Mount BI after KPI cubes |
| `src/i18n/en.ts`, `he.ts` | Labels, empty states, help |
| `src/styles/legacy-theme.css` | `.bi-cube`, badge |
| `HANDOFF.md` | Session note |

---

### Task 1: Migration — BI catalog, config, user grants

**Files:**
- Create: `Mobile App for salesteam/supabase/migrations/20260823190000_bi_modules.sql`

- [ ] **Step 1: Write migration SQL**

```sql
create table if not exists public.app_bi_module (
  id text primary key,
  label text not null,
  description text,
  needs_agent text not null check (needs_agent in ('all_or_one', 'one_only')),
  uses_habit boolean not null default false,
  active boolean not null default true,
  sort_order int not null default 100
);

alter table public.app_bi_module enable row level security;
create policy app_bi_module_select on public.app_bi_module
  for select to authenticated using (true);
create policy app_bi_module_write on public.app_bi_module
  for all to authenticated using (is_super_admin()) with check (is_super_admin());

insert into public.app_bi_module (id, label, description, needs_agent, uses_habit, sort_order) values
  ('missed_items', 'Missed items',
   'Top SKUs usually sold by the agent (or all) that are in stock now.',
   'all_or_one', true, 10),
  ('missed_clients', 'Missed clients',
   'Top clients who usually buy from the agent (or all).',
   'all_or_one', true, 20),
  ('items_sold_by_others', 'Items sold by others',
   'SKUs sold MTD by other suite agents but not by this agent.',
   'one_only', false, 30)
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description,
  needs_agent = excluded.needs_agent,
  uses_habit = excluded.uses_habit,
  sort_order = excluded.sort_order;

create table if not exists public.app_bi_config (
  id boolean primary key default true check (id),
  habit_x int not null default 3 check (habit_x >= 1),
  habit_y int not null default 4 check (habit_y >= 1 and habit_y <= 24),
  updated_at timestamptz not null default now(),
  constraint app_bi_config_xy check (habit_x <= habit_y)
);

alter table public.app_bi_config enable row level security;
create policy app_bi_config_select on public.app_bi_config
  for select to authenticated using (true);
create policy app_bi_config_write on public.app_bi_config
  for all to authenticated using (is_super_admin()) with check (is_super_admin());

insert into public.app_bi_config (id, habit_x, habit_y) values (true, 3, 4)
on conflict (id) do nothing;

create table if not exists public.dashboard_user_bi (
  user_id uuid not null references auth.users(id) on delete cascade,
  bi_module_id text not null references public.app_bi_module(id) on delete cascade,
  primary key (user_id, bi_module_id)
);

alter table public.dashboard_user_bi enable row level security;
create policy dashboard_user_bi_select on public.dashboard_user_bi
  for select to authenticated
  using (user_id = auth.uid() or is_super_admin());
create policy dashboard_user_bi_write on public.dashboard_user_bi
  for all to authenticated using (is_super_admin()) with check (is_super_admin());
```

- [ ] **Step 2: Apply** to project `hzgpkkbqhmtwqhkcntcc` via Supabase MCP `apply_migration`.

- [ ] **Step 3: Commit** migration file (path may be outside app repo — still commit if tracked; else note in HANDOFF).

---

### Task 2: Types + resolve helpers + tests

**Files:**
- Create: `src/types/biModules.ts`
- Create: `src/lib/biModules.ts`
- Create: `src/lib/biModules.test.ts`

- [ ] **Step 1: Failing tests** for `validateHabitXY`, `resolveVisibleBiModuleIds({ isSuperAdmin, isPreviewing, grants, catalog })`.

```ts
it('super-admin not previewing gets all active modules', () => { /* ... */ })
it('preview uses grant set ∩ active only', () => { /* ... */ })
it('rejects habit_x > habit_y or y > 24', () => { /* ... */ })
```

- [ ] **Step 2: Implement** until green.

- [ ] **Step 3: Commit**

```bash
git add src/types/biModules.ts src/lib/biModules.ts src/lib/biModules.test.ts
git commit -m "Add BI module types and visibility helpers."
```

---

### Task 3: Habit + BI metrics (pure) + tests

**Files:**
- Create: `src/lib/biMetrics.ts`
- Create: `src/lib/biMetrics.test.ts`

- [ ] **Step 1: Failing tests** covering:
  - Last Y months including current; `Y_eff < X` → insufficient history flag  
  - Usual item = sales in ≥ X months; rank by cash  
  - Skip missing/≤0 stock; fill to 10  
  - Missed clients same habit on clientID  
  - Items sold by others: MTD others yes, this agent zero; agent-only  

Use small synthetic `SalesRow[]` + stock map. Company = logical id; sales rows use company field as today (`pupik` for sales MTD lines).

- [ ] **Step 2: Implement** `buildMissedItems`, `buildMissedClients`, `buildItemsSoldByOthers` matching the spec.

- [ ] **Step 3: Commit**

```bash
git commit -m "Add pure BI metrics for missed items/clients and sold-by-others."
```

---

### Task 4: API hooks

**Files:**
- Create: `src/lib/biModulesApi.ts`
- Create: `src/hooks/useBiModules.ts`
- Create: `src/hooks/useBiUserGrants.ts`

- [ ] **Step 1: Implement** fetch catalog, config, grants for `userId`; `upsertBiConfig`; `setUserBiGrants(userId, ids[])` (delete missing + insert).

- [ ] **Step 2: Hooks** with TanStack Query keys `['bi-modules']`, `['bi-config']`, `['bi-user-grants', userId]`.

- [ ] **Step 3: Commit**

```bash
git commit -m "Add BI modules API and React Query hooks."
```

---

### Task 5: Admin → Modules page + nav

**Files:**
- Create: `src/pages/admin/ModulesPage.tsx`
- Modify: `src/App.tsx` (route)
- Modify: `src/pages/DashboardLayout.tsx` (nav link; super-admin only like Users/Classes)
- Modify: `src/i18n/en.ts`, `he.ts`

- [ ] **Step 1: Page** — two sections: UI modules (from `useUiModules`, read-only table); BI modules (catalog + descriptions); form for habit X/Y with validation + Save.

- [ ] **Step 2: Wire** `/admin/modules`, `nav.adminModules`.

- [ ] **Step 3: Manual smoke** as super-admin: open page, change 3/4 → save → reload persists.

- [ ] **Step 4: Commit**

```bash
git commit -m "Add Admin Modules page for UI and BI catalogs."
```

---

### Task 6: Admin → Users BI grants

**Files:**
- Modify: `src/pages/admin/UsersPage.tsx` (access editor)

- [ ] **Step 1: Load** active BI catalog + user’s `dashboard_user_bi` in the edit drawer.

- [ ] **Step 2: Checkboxes** for each active BI module; save with existing access upsert flow (separate upsert to `dashboard_user_bi`).

- [ ] **Step 3: Commit**

```bash
git commit -m "Allow per-user BI module grants on Admin Users."
```

---

### Task 7: Suite BI UI cubes

**Files:**
- Create: `src/components/oversite/salesManager/bi/BiBadge.tsx`
- Create: `src/components/oversite/salesManager/bi/BiCubeShell.tsx`
- Create: `src/components/oversite/salesManager/bi/BiMissedItemsCube.tsx`
- Create: `src/components/oversite/salesManager/bi/BiMissedClientsCube.tsx`
- Create: `src/components/oversite/salesManager/bi/BiItemsSoldByOthersCube.tsx`
- Create: `src/components/oversite/salesManager/bi/BiCubesBlock.tsx`
- Modify: `SmAgentWindow.tsx` / `SmCubeGrid.tsx` or suite shell — prefer **`BiCubesBlock` after KPI grid** inside `SmAgentWindow` and Vs company view
- Modify: `SalesManagerSuite.tsx`
- Modify: `legacy-theme.css`, i18n

- [ ] **Step 1: `BiCubesBlock` props** — `visibleIds`, `mode: 'all' | 'agent'`, `agentId`, `company`, `rows`, `stock`, `habit`, `suiteAgents`, `dateCtx`.

- [ ] **Step 2: Alone** — All window: missed items + clients only; agent window: all three if granted. Vs: company-level All-style block.

- [ ] **Step 3: BI badge** on every cube title.

- [ ] **Step 4: Empty / insufficient history** i18n strings.

- [ ] **Step 5: Commit**

```bash
git commit -m "Render BI cubes in Sales Manager suite Alone and Vs."
```

---

### Task 8: Wire grants into suite + View-as

**Files:**
- Modify: `SalesManagerSuite.tsx`
- Use `useAuth` / `usePreview` + `useBiUserGrants` + `useBiModules`

- [ ] **Step 1: Resolve** `visibleBiIds = resolveVisibleBiModuleIds(...)`.

- [ ] **Step 2: Pass** into Alone windows and Vs BI block; pass `wmsStock` from `useDashboardData`.

- [ ] **Step 3: Verify** View-as kfir with no grants → no BI; grant missed_items → cube appears.

- [ ] **Step 4: Commit**

```bash
git commit -m "Gate suite BI cubes on per-user grants and preview."
```

---

### Task 9: Deploy beta + HANDOFF

**Files:**
- Modify: `HANDOFF.md`

- [ ] **Step 1: `npx vitest run`** for biModules + biMetrics; `tsc --noEmit`.

- [ ] **Step 2: Push `beta`**, `vercel deploy`, alias `pupik-sales-dashboard-beta.vercel.app`.

- [ ] **Step 3: Update HANDOFF** Current State + session log (Admin Modules, BI cubes, habit 3/4).

- [ ] **Step 4: Commit HANDOFF** if not already.

---

## Manual test checklist

- [ ] Admin → Modules: UI list + BI list; save habit 3/4; reload OK  
- [ ] Admin → Users: grant/revoke BI for a Sales Manager user  
- [ ] Suite Alone All: Missed items/clients only; BI badge  
- [ ] Suite Alone agent: all three when granted; Items sold by others sensible  
- [ ] Suite Vs: Missed items/clients only  
- [ ] OOS SKU skipped in Missed items  
- [ ] Super-admin sees BI without grant rows; View-as respects target  
- [ ] Production `main` untouched  

---

## Out of scope (do not implement)

- Class BI grants  
- BI outside Sales Manager suite  
- Promote to `main`  
- Server-side habit RPC  
- Per-module different X/Y  
