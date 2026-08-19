# Sidebar Legend (Legend Stage 2) — Design

## Context

Stage 1 shipped a "what am I seeing?" legend for the sales report table (`SalesLegend.tsx`). This
is Stage 2 of the same idea, applied to `SidebarFilters.tsx` — the numbered ①②③④⑤⑥ filter chain
that every report page shares. User's original scoping request: cover **every** control that isn't
obviously clear, not just the two originally-flagged pain points (Tablet vs Group category, Open
Orders vs Stock modes) — full coverage, decided explicitly over a narrower scope.

## Goals

- One consistent "what does this control do?" reference for the whole sidebar, matching the
  existing legend pattern's visual language and code shape.
- For the two genuinely confusing controls (Tablet/Group category, Open Orders/Stock date modes),
  let the user jump straight to the relevant explanation instead of hunting through a long panel.
- Auto-surface it once for a new user, then get out of the way permanently.

## Non-goals

- No per-panel "?" on every single control (rejected — six-plus small icons compete for space in a
  narrow, mostly-mobile sidebar column). Only the two flagged controls get inline jump triggers.
- No redesign of the sidebar's existing layout, numbering, or filter behavior.
- No content-management system — copy lives in `en.ts`/`he.ts` like every other string.

## Approach

Three options were compared visually (single "?" only; per-panel "?" on every control; hybrid —
single "?" plus inline jump-triggers only where actually confusing). **Hybrid was chosen**: one
main entry point keeps visual noise low and matches the existing legend's familiar shape, while the
two controls users actually get stuck on (not the whole chain) get a fast path straight to their
answer.

## Design

### Entry points

- One "?" pill button next to the `filters.global` sidebar label (`<div className="sidebar-label">`
  at the top of `SidebarFilters.tsx`) — same visual treatment as `SalesLegend`'s `legend.help`
  button. Opens the legend panel scrolled to the top (general intro / ① Company).
- Two additional small inline "?" triggers, placed next to:
  - The Tablet/Group category toggle (panel ④ when `f.view === 'items'`).
  - The Date Filter's Open Orders / Stock tabs (panel ②).
  Clicking either opens the same panel already scrolled to that control's subsection, instead of
  the top.
- No inline trigger anywhere else — Company, View chooser, Months multi-select, and the per-view
  Select/Show panels are covered by content but reached only via the main "?".

### Panel structure

Single scrolling panel (like `SalesLegend`, not tabs), organized by section id, in the same order
the sidebar renders its panels. Sidebar panel numbering is **view-dependent** (confirmed against
`SidebarFilters.tsx`): ①②③ are fixed (Company, Date Filter, View), but ④⑤⑥ shift meaning per view —
Clients view has only ④ Select Clients / ⑤ Show mode (two panels, no category step); Items view has
④ Category / ⑤ Select Items / ⑥ Show mode (three panels); Suppliers view has ④ Select Suppliers /
⑤ Show mode (two panels, same shape as Clients). The legend panel's section ids are therefore named
by content, not by a fixed number, so a section id never silently points at the wrong sidebar panel
depending on which view is active:

1. **`company`** — what picking one company vs "All" changes about the data shown.
2. **`dateFilter`** — four subsections, each its own `{term, desc}` block:
   - `dateFilter.range` — start/end date pickers.
   - `dateFilter.months` — multi-select, its own subsection per explicit decision, not folded into
     the general date-mode text, since selecting multiple months has real behavior worth calling
     out (how it affects totals/comparison).
   - `dateFilter.openOrders` — what "open" means in this context (unfulfilled/pending, not yet
     delivered). Reachable via inline jump trigger.
   - `dateFilter.stock` — what this mode replaces sales data with. Reachable via inline jump
     trigger (same trigger as openOrders, since both live on the same ② tab row).
3. **`view`** — Clients / Items / Suppliers, and that switching it changes which panels appear
   below, including how many (two panels for Clients/Suppliers, three for Items).
4. **`itemCategory`** (Tablet vs Group) — Items view only, panel ④. The two independent ERP
   category systems and when each is useful. Reachable via inline jump trigger.
5. **`selectAndShow`** — one shared explanation of what narrowing a Select-list does vs what a
   "show per X" toggle changes about aggregation, written generically enough to cover all three
   variants (select-clients/show-per-client, select-items/show-per-item,
   select-suppliers/show-per-supplier) since the underlying behavior is the same shape in each
   view; view-specific nouns are interpolated rather than duplicated three times.

Content is sourced from the actual current filter/RPC behavior (read during implementation, not
guessed) so the copy can't drift from what the controls really do.

### Auto-open behavior

Single `localStorage` boolean flag, `sidebarLegendSeen` — **not** variant-keyed like
`SalesLegend`'s per-report-shape flag. `SalesLegend` keys by variant because the report's *column
layout itself* changes shape and a stale explanation would be actively wrong; the sidebar legend's
content is comprehensive across all views from the start (§ Panel structure), so there's no "wrong
variant" state to key against — one flag covers every view. First time a user ever sees the
sidebar, the panel auto-opens once, scrolled to the top. Dismissing it (✕, click-outside, or Esc)
sets the flag permanently — it never auto-opens again. The two inline jump triggers work
regardless of the flag's state, since those are always user-initiated.

`localStorage` reads/writes wrapped in try/catch, matching the existing `hasSeen`/`markSeen`
pattern in `SalesLegend.tsx` **exactly**, including its fail-safe direction: on a blocked or
unavailable store, `hasSeen()` returns `true` (never auto-open) rather than `false` — the existing
code's own comment states this explicitly ("storage blocked: never auto-open rather than nag every
render"). The sidebar legend must not invert this: a blocked store means it behaves as already
seen, not as never-seen.

### Component shape

New `SidebarLegend.tsx`, structurally parallel to `SalesLegend.tsx`:
- Not mounted until first opened (matches existing pattern — no cost when unused).
- `linesFor()`-style content function returning `{term, desc}: MessageKey` pairs per subsection,
  keyed by the section ids above (`company`, `dateFilter.range`, `dateFilter.months`,
  `dateFilter.openOrders`, `dateFilter.stock`, `view`, `itemCategory`, `selectAndShow`).
- A `scrollToSection(id: SectionId)` helper. Panel open state and target section id are lifted to
  a small piece of state (e.g. `openLegendSection: SectionId | null`, `null` meaning "closed").
  Both the main "?" and the two inline triggers just call the same setter with a different id/`
  'company'` default; a `useEffect` keyed on that state does the actual scroll once the panel's DOM
  is present, so there's one code path for "open at position X," not a separate open-then-scroll
  sequence per trigger.
- New i18n keys under a `sidebarLegend.*` namespace in `en.ts`/`he.ts`, dot-nested to mirror the
  section ids above (e.g. `sidebarLegend.dateFilter.monthsTerm` /
  `sidebarLegend.dateFilter.monthsDesc`), following the existing `legend.<x>Term` / `legend.<x>Desc`
  pairing convention. `selectAndShow` copy uses `{noun}`-style interpolation (matching the
  `{month}`/`{year}` placeholder pattern already used in `sales.skewWarning`) for the
  clients/items/suppliers-specific nouns, rather than three near-duplicate key sets.

## Error handling & testing

- Static content, no data fetching — no error states to handle beyond the localStorage try/catch
  above.
- No unit tests needed: the only logic is the seen-flag boolean, which mirrors already-shipped,
  tested-by-use code from Stage 1.
- Manual verification during implementation: auto-open fires exactly once per browser, both inline
  jump triggers scroll to the correct subsection, Hebrew (RTL) layout doesn't break the jump-scroll
  or button placement.
