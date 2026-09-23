# Class Oversight layout editor (beta)

**Date:** 2026-09-23  
**Channel:** `beta` only (`pupik-sales-dashboard-beta.vercel.app`; not production `main` until explicitly promoted)  
**Status:** Design locked (user-approved)

## Goal

Let an admin set the look of Oversight for every user in a class. The editor is a drag board plus a short style panel. Each class has two boards: classic Oversight, and the Sales Agent or Sales Manager suite. Users cannot rearrange Oversight themselves.

## CORE RULES (inherited)

- **Oversight ⊥ Sidebar** — this editor never reads or writes sidebar filters.
- **Companies never combined** — the saved card order repeats inside each company column. Company columns stay separate. The second company column keeps its light grey background.
- Ship on **`beta`** only until promote is asked.

## Decisions (locked)

| Topic | Decision |
|--------|----------|
| Who edits | Admin → Classes, which is super-admin only today |
| Who sees it | Every user in that class |
| Surfaces | Two boards per class: `classic` and `suite` |
| Editor | Drag to reorder. Each card is full, half, or third width. Eye hides a card. Style panel sets accent, density, and card style |
| Free canvas | Out of scope |
| Per-user BI and Best sold / Best clients | Stay where they are. Not on this board |
| Unsaved class | Today’s layout, unchanged |
| User deny | A card the user cannot already see stays hidden |
| Year graph | Suite card can be placed, but it still renders only when the class has `year_net_sales` checked |
| Tsomet | Suite card can be placed, but it still renders only on Monkeytime windows that already qualify |
| Phone | Cards stack in the saved order. Width applies at the wide layout only |
| Failed save | Previous saved look stays |

## Editor

On the class editor, section **Oversight look**, after the class is selected.

- Tabs: **Classic** and **Suite**.
- Card list: drag handle, label, width (full / half / third), shown or hidden.
- Style panel for the open tab: accent, density, card style.
- **Save look** writes that class only. It does not rewrite permission grants.
- **Reset** restores that tab to the built-in default and can then be saved.

Style choices:

| Knob | Choices | Default |
|------|---------|---------|
| Accent | indigo, green, amber, slate | indigo |
| Density | comfortable, compact | comfortable |
| Card style | soft, solid, outline | soft |

## Cards

**Classic** ids, default order: `ordersToday`, `ordersMtd`, `openOrders`, `salesMtd`, `topItems`, `suppliers`, `returns`, `debt`, `receipts`, `stockAlerts`. Default width is full. Default visibility matches today’s sections.

**Suite** ids, default order: `salesMtd`, `openOrders`, `tsometOpenBudget`, `returns`, `openDebt`, `ordersLast7`, `receipts`, `yearNetSales`. Default widths match today’s cube grid (top KPI row, then orders and receipts, then the year graph full width). Sales Agent’s built-in default keeps `ordersLast7` hidden, matching today. A saved suite board may show it.

Cards missing from a saved board are appended at the end, visible, at their default width, so a new cube does not disappear. Unknown ids are dropped.

## What users see

- Classic: inside each company column, cards flow in saved order. Full spans the column, half takes half, third takes a third. Below 900px every card is full width, stacked in that order. The second company column stays light grey.
- Single-company classic with no save keeps today’s three-across section grid. Multi-company classic with no save keeps today’s stacked sections.
- Suite: each Alone window and the Vs view use the same suite board. Widths use a 12-column grid: full = 12, half = 6, third = 4. Below 900px every cube is full width, stacked in saved order.
- Per-user Oversight module visibility and widget denies still apply on top of the class layout.
- Sidebar is unchanged.

## Storage

New table `class_oversight_layout`:

- `class_id` text primary key, references `app_class(id)` on delete cascade
- `layout` jsonb not null
- `updated_at` timestamptz not null default now()

`layout` shape:

```json
{
  "classic": {
    "cards": [{ "id": "ordersToday", "width": "full", "hidden": false }],
    "style": { "accent": "indigo", "density": "comfortable", "cardStyle": "soft" }
  },
  "suite": {
    "cards": [{ "id": "salesMtd", "width": "third", "hidden": false }],
    "style": { "accent": "indigo", "density": "comfortable", "cardStyle": "soft" }
  }
}
```

Widths are only `full`, `half`, or `third`. Reads: any authenticated user may read the row for their own class. Writes: super admin only. No row means use the built-in default.

## Error handling

- Save failure shows the error and does not change the stored row.
- A bad width or style value falls back to the default for that field.
- Unknown card ids are ignored. The rest of the board renders.

## Testing

- Saved order, width, hide, and style apply for that class only.
- A second class is unaffected.
- No row uses the built-in default, including Sales Agent hiding the 7-day orders chart.
- A denied card stays hidden.
- `yearNetSales` hidden when the class grant is off, even if the board shows it.
- Below 900px, cards stack in saved order at full width.
- Unknown card ids are dropped. Omitted known cards are appended.

## Out of scope

- Per-user layouts
- Freeform position or custom CSS
- Sidebar
- Production / `main` until an explicit promote
