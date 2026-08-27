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
| Habit default | **3 out of 4** calendar months (admin-editable X / Y; `1 ≤ X ≤ Y ≤ 24`) |
| Stock gate (Missed items) | First filter: only SKUs with WMS qty > 0 enter habit / “sold this month” / ranking; take top 30 by prior-window cash |
| Ranking (Missed items/clients) | Sum **cash** over the Y window, descending; ties: qty desc, then id asc |
| Missing / short lists | Always render granted cube; show 0–10 rows with empty copy when none |
| Cube order | After existing KPI cubes: Missed items → Missed clients → Items sold by others (when applicable) |
| Super-admin (not View-as) | Sees **all active** BI modules in the suite (no grant row required) |
| View-as | Follows **target user’s** BI grants only |
| Inactive BI module | Hidden from suite and from user grant checkboxes; existing grants ignored until reactivated |
| Admin → Modules access | Super-admin only (same gate as Users / Classes) |
| Habit config scope | One shared `habit_x` / `habit_y` for the whole dashboard deployment |
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

- For each non–super-admin user, checkboxes to grant BI module ids (active modules only)  
- Super-admin (own session, not View-as): all **active** BI modules available in suite without grant rows  
- View-as: follows the **target user’s** BI grants only  

### Known limitation

Missed items / Missed clients habit windows **exclude** the current month. “Sold this month” for exclusion still uses partial MTD invoices (891) plus live open orders (721). Early in the month, few invoices mean more items/clients can appear as missed until orders land.

## Runtime — Sales Manager suite

### Grant gate

For each BI cube: user has suite `sales_manager` **and** per-user grant for that BI id. No grant → cube omitted.

### Parameter resolution

| Window | Agent parameter |
|--------|-----------------|
| Alone — All | All suite-scoped agents for that company |
| Alone — agent N | Agent N only |
| Vs (company block) | All suite-scoped agents for that company |

**Suite-scoped agents** = same set as suite windows: `access.agents` if non-empty, else agents present in that company’s sales rows.

### Cubes

Cube order (when granted): after the existing KPI cubes → **Missed items** → **Missed clients** → **Items sold by others** (only if that window allows it).

#### 1. Missed items

1. **Stock first:** only SKUs with company WMS qty **> 0** are considered (missing or ≤ 0 are ignored for habit and ranking — do not walk the full WMS catalog).
2. Take the **previous Y** calendar months (**excluding** the current month). Habit default: at least **X of those Y** months with invoices (e.g. 3 of prior 4).
3. **Data contract / degrade:** habit runs on whatever calendar months exist in already-loaded `rows` for that company (in-stock SKUs only). Let `Y_eff` = number of distinct months available in that prior lookback (capped at Y). If `Y_eff < X`, show the cube with empty state “Not enough history”. Otherwise require at least **X** months with sales among those `Y_eff` months (still labeled as X-of-Y in UI help).
4. An item is **usual** if it had a qualifying invoice in at least **X** of those prior months. Qualifying: for that SKU × agent-parameter × company × month, `sum(qty) ≠ 0` **or** `sum(cash) ≠ 0` (891 sales rows only — not open orders).
5. **Exclude** any usual SKU that, for the same agent-parameter × company, is **sold this month**:
   - any invoice (sales rows for the logical company in the current month), **or**
   - any **open order** row for that company’s open-orders tag (721)
6. Rank remaining by **sum(cash) over the prior Y window**, descending; ties: sum(qty) desc, then SKU asc. Top **30**.
7. Show SKU, name, habit months hit (e.g. `3/4`), prior-window cash, stock qty. No optional “reason line” in v1.

#### 2. Missed clients

1. Take the **previous Y** calendar months (**excluding** the current month). Habit default: at least **X of those Y** months with invoices (e.g. 3 of prior 4).  
2. **Data contract / degrade:** same `Y_eff` rule as Missed items on that prior window. If `Y_eff < X`, empty “Not enough history”.  
3. A client is **usual** if they had a qualifying invoice in at least **X** months in that prior window (agent-parameter × company × `clientID`; qualifying = `sum(qty) ≠ 0` or `sum(cash) ≠ 0`).  
4. **Exclude** any usual client who, in the **current month** for the same agent-parameter × company, has:
   - any invoice (sales rows for the logical company), **or**
   - any **open order** row for that company’s open-orders tag  
5. Rank remaining by **sum(cash) over the prior Y window**, descending; ties: qty desc, then client id asc. Top **30**.  
6. Show client name + habit months hit (e.g. `3/4`) + prior-window cash. Empty copy when none.

#### 3. Items sold by others

- Alone per-agent windows only (hidden on All and Vs).  
- SKUs with MTD sales by **other** agents in the suite agent set ∩ this company, where **this agent** has **zero** MTD sales for that SKU.  
- Rank by others’ total MTD cash; top 10.  
- Show item details + others’ total qty/cash (v1: totals only — no per-other-agent breakdown).  
- Empty copy when none.

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

- Admin → Modules (super-admin only) lists UI + BI; habit X/Y editable, validated (`1 ≤ X ≤ Y ≤ 24`), persisted.  
- Admin → Users can grant/revoke active BI modules per non–super-admin user.  
- Suite Alone/Vs show BI cubes per rules above with BI badge and fixed cube order.  
- Missed items / Missed clients: prior-Y habit (current month excluded); exclude anything with invoice or open orders this month; ranking by prior-window cash; Missed items stock-first (WMS qty > 0) then top 30.  
- Missed items skips OOS and still aims for 10; empty/short lists handled.  
- Items sold by others never appears on All or Vs.  
- Super-admin (not View-as) sees all active BI; View-as uses target grants.  
- Insufficient history (`Y_eff < X`) shows empty-state copy, not fake habits.  
- Production `main` unchanged until explicit promote.  

## Implementation note

Ship on **`beta` branch** + `pupik-sales-dashboard-beta.vercel.app` only.
