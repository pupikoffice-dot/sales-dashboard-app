# Best Sold Items + Best Clients UI Modules (beta / version 2)

**Date:** 2026-08-25  
**Channel:** `beta` only (`pupik-sales-dashboard-beta.vercel.app`; not production `main` until explicitly promoted)  
**Status:** Design locked (user-approved; post spec-review clarifications)

## Goal

Register two ranking modules as **UI catalog rows** so they can be granted per user and composed into suites later:

1. **Best sold items** — top 10 SKUs by MTD cash  
2. **Best clients** — top 10 clients by MTD cash  

Classic Oversight already has **Top 10 Items MTD** (company columns). There is **no** classic Top 10 Clients today — Best clients is suite-first. Do **not** wire either id through the classic-addon render path.

**v1 runtime:** show them only inside the **Sales Manager suite**, in the same compact silver table area as BI (under the 7-day orders chart), **after** all BI cubes for that window.

## CORE RULES (inherited)

- **Oversight ⊥ Sidebar** — these modules never read sidebar filters / Apply.  
- **Companies never combined** — scoped to the current company block only.  
- **Alone / Vs** — suite modes unchanged; placement rules below.  
- Ship on **`beta`** only until promote is asked.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Catalog | Rows in existing `app_ui_module` (not BI catalog) |
| Module ids | `best_sold_items`, `best_clients` |
| Kind | `addon` (surface `oversight`) for catalog shape only |
| Suite-mountable allowlist (v1) | **Hardcoded:** `{ best_sold_items, best_clients }` only — export as `SUITE_MOUNTABLE_UI_MODULE_IDS` in code |
| Class UI / Classes admin | **Exclude** allowlist ids from oversight UI-module checkboxes in `PermissionSections` / Classes / user permission overrides. Do not offer them as class addons. |
| Class grant keys at runtime | **Ignore** any `ui.oversight.addon.best_sold_items` / `ui.oversight.addon.best_clients` in `mapGrantKeysToUiModules` and/or `pickOversightMode` so they never enter classic `addonIds` |
| Classic Oversight | No change to existing Top 10 Items; no classic render of these UI-module ids |
| Where they show (v1) | Sales Manager suite only |
| Mount composition | Same `sm-orders-bi` region as BI; render **after** `BiCubesBlock`. Order: BI cubes (existing rules) → Best sold items → Best clients |
| Windows | Alone All + Alone agent + Vs (company-level) |
| Scope | Company of the block × agents of that window (All / Vs = suite agents; agent window = that agent). Match suite KPI / BI agent-narrow helpers. |
| Timeframe | Current calendar month **MTD** via `year`/`month` on sales rows for the logical company id (same idea as `computeSalesMtdTop10` + agent narrow). Not sidebar date range. |
| Ranking | Top **10** by sum(cash) desc; ties: qty desc, then id asc (SKU / clientID) |
| Best sold columns | SKU, name, total qty, total cash |
| Best clients columns | Client #, name, total cash |
| Name when ambiguous | Last non-empty name seen while aggregating |
| Assignment | **Per-user** grants on Admin → Users |
| Grant replace | Only insert/delete rows for the **suite-mountable allowlist** ids — never wipe unrelated future `dashboard_user_ui` keys |
| Super-admin (not View-as) | Sees **all active** allowlist modules in the suite (no grant row required) |
| View-as | Target user’s grants only (including when target is super-admin with empty grant rows → none shown). Same as BI. |
| Inactive module | Hidden from suite and from user grant checkboxes |
| Visual | Compact silver tables like BI; **no BI badge** |
| i18n | EN + HE titles, column headers, empty states |

## Catalog seed (`app_ui_module`)

| id | Label | Surface | Kind | Active |
|----|--------|---------|------|--------|
| `best_sold_items` | Best sold items | oversight | addon | true |
| `best_clients` | Best clients | oversight | addon | true |

Admin → Modules lists them read-only with other UI modules.  
Admin → Classes does **not** show them as grantable UI modules (filtered by allowlist exclusion).

## Per-user grants

### Schema (additive)

`dashboard_user_ui`:

- `user_id` uuid → `auth.users`  
- `ui_module_id` text → `app_ui_module(id)`  
- primary key `(user_id, ui_module_id)`  

RLS: mirror `dashboard_user_bi` (own select; super-admin write).

### Admin → Users

- Checkbox section for **active allowlist** modules (`best_sold_items`, `best_clients`).  
- Shown for all user edits (including super-admin profiles); grants matter for View-as.  
- Do **not** offer the Sales Manager **suite** id as a per-user grant.

### Visibility resolve

```
suiteMountableIds = { best_sold_items, best_clients }  // hardcoded v1
visible =
  active catalog ∩ suiteMountableIds ∩
  (super-admin && !previewing ? all of those : user’s dashboard_user_ui)
```

## Runtime — Sales Manager suite

### Alone / Vs

| Window | Agent scope | Modules if granted |
|--------|-------------|--------------------|
| Alone — All | Suite-scoped agents | Best sold + Best clients |
| Alone — agent N | Agent N | Best sold + Best clients |
| Vs | Suite-scoped agents | Best sold + Best clients |

### Empty

Always render granted cube; empty-state copy when no MTD rows in scope.

## Out of scope

- Promote to `main`  
- Classic addon rendering of these ids  
- Class-level grants for these modules  
- Habit / stock gates  
- Sidebar UI modules  
- New suites beyond Sales Manager  

## Success criteria

- [ ] Catalog rows on Admin → Modules; **not** on Classes UI-module checkboxes  
- [ ] Per-user grants on Admin → Users persist (allowlist only)  
- [ ] Granted user on beta suite sees MTD top-10 tables after BI (Alone All / agent / Vs)  
- [ ] Ungranted non–super-admin does not see them  
- [ ] View-as respects target grants  
- [ ] Classic Oversight Top 10 Items unchanged  
- [ ] Class `ui.oversight.addon.best_*` keys (if any) do not affect classic layout  
- [ ] `main` / production untouched  

## Open follow-ups (not v1)

- General suite-tile composition beyond hardcoded allowlist  
- Optional UI badge  
