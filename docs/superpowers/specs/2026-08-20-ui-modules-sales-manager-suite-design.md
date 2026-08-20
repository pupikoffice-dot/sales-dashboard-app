# UI Modules + Sales Manager Suite (beta / version 2)

**Date:** 2026-08-20  
**Channel:** `beta` only (not production `main` until explicitly promoted)  
**Status:** Design locked (post spec-review clarifications)

## Goal

Introduce **UI modules** as assignable layout constructs for classes, with two Oversight kinds:

1. **Suite** — replaces classic Oversight entirely for that class  
2. **Addon** (formerly called “widget” in brainstorming) — appends into classic Oversight  

Naming: use **addon** in the product/spec so it is not confused with legacy classic-section grants (`widget.ordersToday`, etc.).

First concrete module: **Sales Manager Module** (`sales_manager`) — Oversight **suite**.

## CORE RULE — Oversight ⊥ Sidebar

**Oversight** and **Sidebar** must not drive each other’s UI.

| Surface | Function |
|---------|----------|
| Oversight | Fixed information layout (suite or classic + addons), configured in advance via class UI modules |
| Sidebar | Separate filter / enquiry system for analysis and reports |

They operate on the **same underlying data** and the **same class restrictions** (companies, agents, fields), but:

- Sidebar filters / Apply **never** change Oversight content or navigate away from a suite.  
- Oversight layout **never** changes sidebar filter state.  

This overrides today’s legacy coupling where some non–super-admins leave Oversight on Apply.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Where suite appears | Replaces whole Oversight page content for granted users |
| Without suite | Classic Oversight unchanged |
| Company scope (suite KPIs) | Aggregate across **all companies** in the user’s access |
| Agent set | Class / access agent scope within that company access; empty agent list = all agents in scope |
| Window order | “All agents” first, then per-agent windows numeric low→high (vertical stack; scroll) |
| Segment presentation | Soft translucent cubes |
| Desktop layout | **4 + 2** — top: Sales MTD+Goal, Open orders, Returns, Open debt; bottom: wide Orders (7 workdays) + Receipts |
| Responsive | &lt;900px: 2×2 KPIs → Orders full width → Receipts |
| Suite vs addon | ≤1 oversight suite per class (admin + runtime); if suite present, addons ignored |
| Beta grant wiring | **Read class UI-module grants on beta** even while Phase 3 shadow mode remains for production data path |
| Receipts | Shown for suite users on beta, scoped to their agents/companies (open data path on beta) |
| Goals source | Sync Excel → Supabase; dashboard reads DB only |
| View-as | Preview follows the **target user’s** suite grant |
| Approach | UI module registry + class grants |

## UI module model

Catalog fields:

- `id` (stable slug, e.g. `sales_manager`)
- `label`
- `surface`: `oversight` \| `sidebar`
- `kind`: `suite` \| `addon`
- `active`

**Assignment:** class grants via distinct node keys, e.g. `ui.oversight.suite.sales_manager`, `ui.oversight.addon.<id>`.  
Do **not** reuse legacy `widget.*` keys used for classic Oversight section toggles.

**While a suite is active:** ignore classic `oversite_modules` / legacy `widget.*` for rendering (suite owns the page).

**Sidebar surface:** schema-ready; no sidebar modules in this slice (admin may hide sidebar grants).

**Overrides:** v1 class-only (no per-user suite override). Runtime: if somehow multiple suites, prefer the single class suite; admin prevents &gt;1.

### Oversight render algorithm (beta)

1. Resolve UI-module grants from the user’s class (`app_grant` / class assignment).  
2. If an oversight **suite** is granted → render that suite only.  
3. Else → classic Oversight + any oversight **addons**.  
4. Never consult sidebar filter / Apply state for suite or classic Oversight layout.

## Sales Manager suite — content

### Windows

1. **All agents** — aggregate over scoped agents (and all allowed companies)  
2. **Per agent** — one window each, agent code ascending  

### Cubes (every window)

| Cube | Content |
|------|---------|
| Sales MTD + Goal | MTD cash (Oversight Sales MTD meaning, all allowed companies); Goal = current calendar month from `sales_agent_targets`. All-window goal = **sum** of scoped agents’ targets (missing target → treat as 0 for the sum; show `—` on that agent’s cube if missing) |
| Open orders | Oversight Open Orders meaning, scoped |
| Returns | Oversight Returns MTD meaning, scoped |
| Open debt | Oversight Open Debt meaning, scoped |
| Orders (last 7 workdays) | Israel workweek chart (exclude Fri/Sat) + full order report entry; tallest cube |
| Receipts | Team/agent receipts scoped to suite agents/companies on beta |

### Layout grid

```
Desktop (≥900px)
┌──────────┬──────────┬──────────┬──────────┐
│ MTD+Goal │ Open ord │ Returns  │ Debt     │
├─────────────────────┴──────────┼──────────┤
│ Orders (7 workdays)            │ Receipts │
└────────────────────────────────┴──────────┘

Phone/Tablet (<900px)
┌──────────┬──────────┐
│ MTD+Goal │ Open ord │
├──────────┼──────────┤
│ Returns  │ Debt     │
├──────────┴──────────┤
│ Orders (full width) │
├─────────────────────┤
│ Receipts            │
└─────────────────────┘
```

## Data

### Goals ETL

- Source: `Z:\Biz-Dev\Data\salesagentstargets26.xlsx` (Sheet1; `agent` + months 1–12)  
- Table: `sales_agent_targets` (`agent_erp_id text`, `year int`, `month int`, `target_cash numeric`, `updated_at`)  
- Year: 2026 from filename convention  
- Write strategy: upsert by (agent, year, month); replace-year optional on full file reload  
- Agent ids stored as text matching ERP agent codes  
- Sync on office PC; **table is shared Supabase** (safe additive); only beta UI consumes it initially  
- Dashboard never reads the Excel file directly  

### Other KPIs

Existing Supabase pipelines; filter by `access.companies` (all of them) and agent scope. No sidebar filter state.

## Admin (beta)

1. Seed + manage UI module catalog.  
2. Classes: grant suites/addons; enforce ≤1 oversight suite; note addons ignored when suite set.  
3. Assign `sales_manager` suite to Sales Manager class for testing.  

## Out of scope

- Promote UI to production `main`  
- Phase 3 full live RPC cutover for all permissions (beta **does** read UI-module class grants for Oversight layout only)  
- Sidebar-surface UI modules  
- Addon examples beyond this suite  

## Success criteria

- Suite user on beta: Sales Manager Oversight only; Apply/filters never alter it.  
- Non-suite user: classic Oversight.  
- Production unchanged.  
- Agent windows + All respect scope; companies aggregated per access.  
- Goals match Excel after sync.  
- 4+2 desktop / stacked mobile; Orders chart usable on phone.  
- Receipts visible and scoped for suite users on beta.  

## Implementation note

Ship on **`beta` branch** + `pupik-sales-dashboard-beta.vercel.app` only.
