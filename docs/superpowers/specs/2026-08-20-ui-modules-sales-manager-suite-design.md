# UI Modules + Sales Manager Suite (beta / version 2)

**Date:** 2026-08-20  
**Channel:** `beta` only (not production `main` until explicitly promoted)  
**Status:** Design approved in brainstorming session

## Goal

Introduce **UI modules** as assignable layout constructs for classes, with two Oversight kinds:

1. **Suite** — replaces classic Oversight entirely for that class  
2. **Widget** — appends into classic Oversight  

First concrete module: **Sales Manager Module** (`sales_manager`) — Oversight **suite**.

Sidebar filters do **not** affect Oversight UI modules (filters remain for analysis/reports only).

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Where suite appears | Replaces whole Oversight page content for granted users |
| Without suite | Classic Oversight unchanged |
| Agent set | Class / access agent scope; empty = all agents |
| Window order | “All agents” first, then per-agent windows numeric low→high |
| Segment presentation | Translucent cubes, not a tall 1–6 vertical list |
| Desktop layout | **A: 4 + 2** — top row four compact cubes (Sales MTD+Goal, Open orders, Returns, Open debt); bottom row wide Orders today + Receipts |
| Responsive | ≥900px: 4+2; 700–899 and &lt;700: 2×2 KPIs → Orders full width → Receipts |
| Suite vs widget | ≤1 suite per class; if suite present, widgets ignored |
| Goals source | Sync `Z:\Biz-Dev\Data\salesagentstargets26.xlsx` → Supabase (col A = agent, row 1 = months 1–12) |
| Approach | UI module registry + class grants (not hardcoding-only) |

## UI module model

Catalog fields:

- `id` (stable slug, e.g. `sales_manager`)
- `label`
- `surface`: `oversight` \| `sidebar`
- `kind`: `suite` \| `widget`
- `active`

**Assignment:** grant to a **class** (permission-node style, e.g. `ui.oversight.suite.sales_manager`).  
**Sidebar surface:** schema-ready; no sidebar modules in this slice.

### Oversight render algorithm

1. Resolve user’s UI-module grants from class (+ overrides if we wire them later; v1 class-only is enough).  
2. If any **suite** → render that suite only (enforce ≤1 at admin save).  
3. Else → classic Oversight sections + any **widget** modules appended.  
4. Ignore sidebar company/date/view filters for suite/widget data.

## Sales Manager suite — content

### Windows

1. **All agents** — aggregate over scoped agents  
2. **Per agent** — one window each, sorted by agent code ascending  

### Cubes (same set in every window)

| Cube | Content |
|------|---------|
| Sales MTD + Goal | MTD cash (same meaning as Oversight Sales MTD); Goal = current calendar month from synced targets |
| Open orders | Same meaning as Oversight Open Orders |
| Returns | Same meaning as Oversight Returns MTD |
| Open debt | Same meaning as Oversight Open Debt |
| Orders today | Last **7 workdays** chart + access to **full order report** (reuse existing Oversight patterns where practical). This is the tallest cube — desktop gives it 2/3 of the bottom row |
| Receipts | Same meaning as Oversight Receipts |

Visual: soft translucent cubes (low-contrast border/fill), readable but not loud.

### Layout grid

```
Desktop (≥900px)
┌──────────┬──────────┬──────────┬──────────┐
│ MTD+Goal │ Open ord │ Returns  │ Debt     │
├─────────────────────┴──────────┼──────────┤
│ Orders today (7 workdays)      │ Receipts │
└────────────────────────────────┴──────────┘

Tablet/Phone (<900px)
┌──────────┬──────────┐
│ MTD+Goal │ Open ord │
├──────────┼──────────┤
│ Returns  │ Debt     │
├──────────┴──────────┤
│ Orders today (full) │
├─────────────────────┤
│ Receipts            │
└─────────────────────┘
```

## Data

### Goals ETL

- Source: `Z:\Biz-Dev\Data\salesagentstargets26.xlsx` (Sheet1; header `agent`, columns 1–12 = months)  
- Destination: new Supabase table (e.g. `sales_agent_targets`: `agent_erp_id`, `year`, `month`, `target_cash`, updated_at)  
- Year: file name / config for 2026 (`salesagentstargets26`)  
- Sync: office PC schedule (extend existing sync tooling); dashboard reads Supabase only  

### Other KPIs

Reuse existing Supabase sales/orders/debt/receipts pipelines; scope rows by agent set. No dependency on sidebar filter state.

## Admin (beta)

1. UI Modules admin (list/create/edit catalog — can start seeded + minimal editor).  
2. Classes editor: grant UI modules; validate ≤1 oversight suite; show that widgets are ignored when suite is set.  
3. Seed `sales_manager` suite and assign to Sales Manager class when ready.

## Out of scope (this slice)

- Promoting UI to production `main`  
- Phase 3 live RPC permission cutover  
- Building sidebar-surface modules  
- Widget examples beyond the suite  

## Success criteria

- User with Sales Manager suite sees only the Sales Manager Oversight (not classic sections).  
- User without suite sees classic Oversight.  
- All + per-agent windows respect agent scope; empty scope = all agents.  
- Goals match Excel for current month after sync.  
- Desktop 4+2 and mobile stack usable; Orders today chart readable on phone.  

## Implementation note

Ship on **`beta` branch** + redeploy `pupik-sales-dashboard-beta.vercel.app` only.
