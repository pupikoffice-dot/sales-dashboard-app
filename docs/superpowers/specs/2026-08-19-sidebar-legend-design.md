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

- One "?" pill button next to the "GLOBAL FILTERS" heading at the top of the sidebar — same visual
  treatment as `SalesLegend`'s `legend.help` button. Opens the legend panel scrolled to the top
  (general intro / ① Company).
- Two additional small inline "?" triggers, placed next to:
  - The Tablet/Group category toggle (④, Items view).
  - The Date Filter's Open Orders / Stock tabs (② panel).
  Clicking either opens the same panel already scrolled to that control's subsection, instead of
  the top.
- No inline trigger anywhere else — Company, View chooser, Months multi-select, and the per-view
  Select/Show controls are covered by content but reached only via the main "?".

### Panel structure

Single scrolling panel (like `SalesLegend`, not tabs), organized by the same numbering as the
sidebar itself so the mapping between sidebar and legend is immediate:

1. **① Company** — what picking one company vs "All" changes about the data shown.
2. **② Date Filter** — four subsections, each its own `{term, desc}` block:
   - Range (start/end date pickers)
   - Months (multi-select) — its own subsection per explicit decision, not folded into the general
     date-mode text, since selecting multiple months has real behavior worth calling out (how it
     affects totals/comparison).
   - Open Orders — what "open" means in this context (unfulfilled/pending, not yet delivered).
   - Stock — what this mode replaces sales data with.
3. **③ View** — Clients / Items / Suppliers, and that switching it changes which panels appear
   below (④⑤⑥).
4. **④ Tablet vs Group category** (Items view only) — the two independent ERP category systems and
   when each is useful. Reachable via inline jump trigger.
5. **⑤/⑥ Select + Show mode** (per-view: Clients, Items, or Suppliers) — what narrowing the
   selection does vs what the "show per X" toggle changes about aggregation.

Content is sourced from the actual current filter/RPC behavior (read during implementation, not
guessed) so the copy can't drift from what the controls really do.

### Auto-open behavior

Single `localStorage` boolean flag, `sidebarLegendSeen` — **not** variant-keyed like
`SalesLegend`'s per-report-shape flag, since the sidebar doesn't change shape the way a report
does. First time a user ever sees the sidebar, the panel auto-opens once, scrolled to the top.
Dismissing it (✕, click-outside, or Esc) sets the flag permanently — it never auto-opens again.
The two inline jump triggers work regardless of the flag's state, since those are always
user-initiated.

`localStorage` reads/writes wrapped in try/catch, matching the existing `hasSeen`/`markSeen`
pattern — a blocked or unavailable store just means the panel auto-opens every load instead of
throwing.

### Component shape

New `SidebarLegend.tsx`, structurally parallel to `SalesLegend.tsx`:
- Not mounted until first opened (matches existing pattern — no cost when unused).
- `linesFor()`-style content function returning `{term, desc}: MessageKey` pairs per subsection.
- A `scrollToSection(id)` helper invoked by the two inline triggers after the panel mounts/opens.
- New i18n keys under a `sidebarLegend.*` namespace in `en.ts`/`he.ts`, mirroring the existing
  `legend.*` keys' naming style.

## Error handling & testing

- Static content, no data fetching — no error states to handle beyond the localStorage try/catch
  above.
- No unit tests needed: the only logic is the seen-flag boolean, which mirrors already-shipped,
  tested-by-use code from Stage 1.
- Manual verification during implementation: auto-open fires exactly once per browser, both inline
  jump triggers scroll to the correct subsection, Hebrew (RTL) layout doesn't break the jump-scroll
  or button placement.
