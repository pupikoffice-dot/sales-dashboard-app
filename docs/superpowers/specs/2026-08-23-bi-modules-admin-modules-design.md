# BI Modules + Admin Modules Tab (beta / version 2)

**Date:** 2026-08-23  
**Channel:** `beta` only (not production `main` until explicitly promoted)  
**Status:** Design locked (user-approved)

## Goal

Add three **Business Intelligence (BI)** modules for Sales Manager suite users, with:

1. An **Admin → Modules** tab to inspect UI modules and BI modules and edit BI parameters  
2. **Per-user** BI grants on Admin → Users  
3. BI **cubes inside the Sales Manager suite** (with a clear BI visual badge)

## CORE RULES (inherited)

- **Oversight ⊥ Sidebar** — BI never reads sidebar filters / Apply.  
- **Companies never combined** — BI is scoped to the current company block only.  
- **Alone / Vs** — suite modes unchanged; BI placement rules below.  
- Ship on **`beta`** only until promote is asked.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Admin surface | New nav tab **Admin — Modules** beside Users / Classes |
| Catalog | Separate **BI** catalog from **UI** modules (Admin Modules shows both) |
| BI assignment | **Per-user** grants on Admin → Users (not class grants in v1) |
| Where BI shows | Sales Manager suite cubes only (suite replaces Oversight) |
| Alone — All window | Missed items + Missed clients (parameter = all suite agents); **Items sold by others** hidden |
| Alone — per-agent window | All three BI cubes (if granted) |
| Vs | One company-level BI block: Missed items + Missed clients (all agents); no Items sold by others |
| Habit default | **3 out of 4** calendar months (admin-editable X / Y) |
| Stock gate (Missed items) | Skip SKUs with stock ≤ 0; keep filling until 10 (or list exhausted) |
| BI affordance | Distinct **BI** icon/badge on every BI cube |

## Admin — Modules

### UI modules section

- List active/inactive rows from existing `app_ui_module`  
- Read-only details: id, label, surface, kind (suite/addon), active  
- No parameter editing for UI modules in v1  

### BI modules section

Catalog (seeded):

| id | Label | Needs agent | Habit params |
|----|--------|-------------|--------------|
| `missed_items` | Missed items | All or one agent | Yes (X of Y) |
| `missed_clients` | Missed clients | All or one agent | Yes (X of Y) |
| `items_sold_by_others` | Items sold by others | One agent only | No |

- Show description + which suite windows use it  
- Edit shared habit parameters: **X months out of Y months** (integers, `1 ≤ X ≤ Y`, `Y ≥ 1`). Default **X=3, Y=4**.  
- Persist params in DB (single shared config row or per-module JSON; implementation may use one `app_bi_config` / columns on `app_bi_module`)  

### Admin — Users

- For each non–super-admin user, checkboxes to grant BI module ids  
- Super-admin preview (“View as”) follows the **target user’s** BI grants  

## Runtime — Sales Manager suite

### Grant gate

For each BI cube: user has suite `sales_manager` **and** per-user grant for that BI id. No grant → cube omitted.

### Parameter resolution

| Window | Agent parameter |
|--------|-----------------|
| Alone — All | All suite-scoped agents for that company |
| Alone — agent N | Agent N only |
| Vs (company block) | All suite-scoped agents for that company |

### Cubes

#### 1. Missed items

1. Consider last **Y** completed calendar months ending at the month **before** current (or including current — see note below).  
2. An item is **usual** for the agent parameter if it had sales (qty or cash ≠ 0) in at least **X** of those **Y** months.  
3. Rank usual items (e.g. by total cash or qty over the Y window — use cash descending).  
4. Walk the ranked list; **skip** if company WMS stock for that SKU ≤ 0; take first **10** in-stock.  
5. Show SKU, name, habit months hit, stock qty; optional short reason line.

**Month window note (locked):** use the last **Y** calendar months **including the current month** (partial MTD counts as a “sold” month if any sale exists). Document in UI help text.

#### 2. Missed clients

Same habit rule on **clientID** (purchase from agent parameter in that company). No stock gate. Top **10** clients by total cash over the Y window among those who meet X-of-Y. Show client id/name + habit months.

#### 3. Items sold by others

- Alone per-agent windows only (hidden on All and Vs).  
- SKUs with MTD sales by **other** agents in the suite agent set ∩ this company, where **this agent** has **zero** MTD sales for that SKU.  
- Rank by others’ total MTD cash; top 10.  
- Show item details + others’ total qty/cash (and optionally which agents — v1: totals only is enough).

### Visual

- BI cubes use a shared chrome: e.g. `BI` badge / icon in the cube title so they are never confused with Sales MTD / Debt KPI cubes.

## Data

- Sales: existing dashboard `rows` (company-scoped tags as today).  
- Stock: existing `wmsRows` / `wmsStock` maps per company.  
- No Excel reads from the browser.  
- Habit math is client-side from already-loaded rows for v1 (same pattern as suite KPIs). If performance requires, later move to RPC — out of scope for v1.

## Schema (additive, shared Supabase OK)

Suggested (names flexible at implement time):

- `app_bi_module` — id, label, description, needs_agent (`all_or_one` \| `one_only`), uses_habit bool, active, sort_order  
- `app_bi_config` — singleton or keyed: `habit_x`, `habit_y` (defaults 3, 4)  
- `dashboard_user_bi` or columns / join table: `user_id`, `bi_module_id` grants  

RLS: super-admin manage; users read own grants (or resolve via existing admin RPC patterns).

## Out of scope

- Promote to `main`  
- Class-level BI grants  
- BI outside Sales Manager suite  
- Sidebar-driven BI  
- Server-side habit ETL / RPC optimization  
- Per-module different X/Y (v1: one shared X/Y for both missed modules)

## Success criteria

- Admin → Modules lists UI + BI; habit X/Y editable and persisted.  
- Admin → Users can grant/revoke the three BI modules per user.  
- Suite Alone/Vs show BI cubes per rules above with BI badge.  
- Missed items skips OOS and still aims for 10.  
- Items sold by others never appears on All or Vs.  
- Production `main` unchanged until explicit promote.  

## Implementation note

Ship on **`beta` branch** + `pupik-sales-dashboard-beta.vercel.app` only.
