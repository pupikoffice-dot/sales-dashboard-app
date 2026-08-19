# Sidebar Legend (Stage 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "what does this control do?" legend to the sidebar filter chain, mirroring the
existing `SalesLegend` pattern, with two inline jump-triggers for the genuinely confusing controls
(Tablet/Group category, Open Orders/Stock date modes).

**Architecture:** One new component `SidebarLegend.tsx`, structurally parallel to
`SalesLegend.tsx` — not mounted until opened, single scrolling content panel, `localStorage`-backed
once-ever auto-open flag. Mounted inside `SidebarFilters.tsx` next to the existing `sidebar-label`.
Two small inline "?" triggers live inside `SidebarFilters.tsx` itself and control the legend via
lifted state (`openLegendSection`) passed down as props, so there's one code path for "open at
position X" regardless of which trigger fired it.

**Tech Stack:** React + TypeScript, existing `i18n` flat-key catalog (`en.ts`/`he.ts`), existing
`.legend-*` CSS classes in `legacy-theme.css`, `vitest` for the one unit test this needs.

**Spec:** `docs/superpowers/specs/2026-08-19-sidebar-legend-design.md` — read this first for the
full rationale; this plan only restates what's needed to build it.

---

## File structure

- **Create** `src/components/sidebar/SidebarLegend.tsx` — the legend panel component + its
  `hasSeen`/`markSeen`/section-content logic. All new code lives here except the two inline trigger
  buttons (which must live in `SidebarFilters.tsx` next to the controls they explain) and the state
  that coordinates them.
- **Create** `src/components/sidebar/SidebarLegend.test.ts` — one unit test for the `hasSeen`
  fail-safe direction (the exact bug class the spec review caught in the design phase).
- **Modify** `src/components/sidebar/SidebarFilters.tsx` — add `openLegendSection` state, mount
  `<SidebarLegend>`, add the two inline trigger buttons.
- **Modify** `src/i18n/en.ts` and `src/i18n/he.ts` — add ~20 new `sidebarLegend.*` keys (exact list
  in Task 2).
- **Modify** `src/styles/legacy-theme.css` — add a `.legend-btn-sm` size-modifier class for the two
  inline triggers, plus a small `scroll-margin-top` rule so `scrollIntoView` doesn't tuck a section
  under the panel header.

---

### Task 1: Section ids and content-lookup skeleton (TDD on the pure logic first)

**Files:**
- Create: `src/components/sidebar/SidebarLegend.tsx`
- Test: `src/components/sidebar/SidebarLegend.test.ts`

This task builds the two pure, testable pieces first: the `hasSeen`/`markSeen` storage helpers
(copied pattern from `SalesLegend.tsx`, this is where the design review caught a fail-safe-direction
bug, so it gets a real test) and the `SectionId` union.

- [ ] **Step 1: Write the failing test for the storage fail-safe direction**

```typescript
// src/components/sidebar/SidebarLegend.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { hasSeenSidebarLegend, markSidebarLegendSeen } from './SidebarLegend'

describe('sidebar legend seen-flag storage', () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it('is unseen by default', () => {
    expect(hasSeenSidebarLegend()).toBe(false)
  })

  it('is seen after marking', () => {
    markSidebarLegendSeen()
    expect(hasSeenSidebarLegend()).toBe(true)
  })

  it('treats a blocked localStorage as already-seen, not never-seen', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    // Must return true (already seen) on a blocked store, matching SalesLegend's
    // hasSeen() fail-safe — never auto-open rather than nag every render.
    expect(hasSeenSidebarLegend()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run (from the worktree root): `npm run test -- SidebarLegend.test.ts`
Expected: FAIL — `SidebarLegend.tsx` (and the two exports) don't exist yet.

- [ ] **Step 3: Write the minimal storage helpers + section id type**

```typescript
// src/components/sidebar/SidebarLegend.tsx (new file, grows across later tasks)
import type { MessageKey } from '../../i18n/types'

/**
 * "What does this control do?" legend for the sidebar filter chain.
 * See docs/superpowers/specs/2026-08-19-sidebar-legend-design.md for the design.
 *
 *  - The panel is NOT mounted until opened (matches SalesLegend — costs nothing
 *    when unused).
 *  - Auto-opens once ever per browser (not per-variant like SalesLegend, since
 *    this content is comprehensive across all views from the start — see spec).
 *  - Two inline "?" triggers elsewhere in SidebarFilters.tsx can jump the panel
 *    open already scrolled to a specific section; that's what SectionId and
 *    openLegendSection (owned by SidebarFilters) are for.
 */

const STORAGE_KEY = 'dash-sidebar-legend-seen'

export function hasSeenSidebarLegend(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return true // storage blocked: treat as already seen, never auto-open (matches SalesLegend)
  }
}

export function markSidebarLegendSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, '1')
  } catch { /* ignore */ }
}

/** Every jumpable/described section in the legend. Order here is display order. */
export type SectionId =
  | 'company'
  | 'dateFilterRange'
  | 'dateFilterMonths'
  | 'dateFilterOpenOrders'
  | 'dateFilterStock'
  | 'view'
  | 'itemCategory'
  | 'select'
  | 'showModeBreakdown'
  | 'showModeItems'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- SidebarLegend.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/sidebar/SidebarLegend.tsx src/components/sidebar/SidebarLegend.test.ts
git commit -m "feat(sidebar-legend): add seen-flag storage + section ids, TDD'd fail-safe direction"
```

---

### Task 2: i18n content keys

**Files:**
- Modify: `src/i18n/en.ts`
- Modify: `src/i18n/he.ts`

Add the exact keys the spec pins down. Insert after the existing `filters.*` block (после line 120
in `en.ts` — check current line count first, the file has grown since Stage 1's `legend.*` block
was added near the top).

- [ ] **Step 1: Add English keys**

Add to `src/i18n/en.ts` (any reasonable location, grouped together — suggest right after the
`filters.*` block):

```typescript
  'sidebarLegend.help': 'What do these filters do?',
  'sidebarLegend.title': 'Sidebar filters, explained',
  'sidebarLegend.companyTerm': 'Company',
  'sidebarLegend.companyDesc':
    'Picking one company shows only that company’s data. "All" merges every company you have access to into one combined view.',
  'sidebarLegend.dateFilterRangeTerm': 'From / To',
  'sidebarLegend.dateFilterRangeDesc': 'A plain date range — shows everything that happened between the two dates.',
  'sidebarLegend.dateFilterMonthsTerm': 'Months',
  'sidebarLegend.dateFilterMonthsDesc':
    'Pick one or more whole months instead of a date range. Selecting several months adds them together into one combined total — it does not show them side by side.',
  'sidebarLegend.dateFilterOpenOrdersTerm': 'Open Orders',
  'sidebarLegend.dateFilterOpenOrdersDesc':
    'Orders placed but not yet delivered (source: file 721). This is a different data source from sales — not a filter on the sales numbers.',
  'sidebarLegend.dateFilterStockTerm': 'Stock',
  'sidebarLegend.dateFilterStockDesc':
    'Switches away from sales entirely and shows current warehouse stock levels instead.',
  'sidebarLegend.viewTerm': 'View',
  'sidebarLegend.viewDesc':
    'Chooses what the report is organized by — Clients, Items, or Suppliers. This changes which filter panels appear below it.',
  'sidebarLegend.itemCategoryTerm': 'Tablet vs Group Category',
  'sidebarLegend.itemCategoryDesc':
    'Two separate category systems from the ERP that don’t line up with each other. "Tablet Category" is the grouping used on the sales tablets at point of sale; "Group Category" is a separate back-office grouping. Picking the wrong one for what you’re trying to find is the most common source of "why is this item missing" confusion.',
  'sidebarLegend.selectTerm': 'Select {noun}',
  'sidebarLegend.selectDesc':
    'Narrows the report to only the {noun} you check. Everything is selected by default; use search to find specific ones quickly.',
  'sidebarLegend.showModeBreakdownTerm': 'Show mode',
  'sidebarLegend.showModeBreakdownDesc':
    '"Items breakdown" lists every line item; "Cash summary" collapses them into one total line. Same data, different level of detail.',
  'sidebarLegend.showModeItemsTerm': 'Show mode',
  'sidebarLegend.showModeItemsDesc':
    '"By Clients" groups the selected items by which client bought them; "Items summary" groups by item instead, across all clients.',
```

- [ ] **Step 2: Add matching Hebrew keys**

Read the existing Hebrew equivalents for tone/register first:

Run: check `src/i18n/he.ts` around the `filters.*` section (same line range as `en.ts`) for style
reference, then add the matching `sidebarLegend.*` block with the same key names, Hebrew values.
(Translate directly — no placeholder/TODO values; this app ships bilingual from day one per
existing convention.)

- [ ] **Step 3: Run typecheck to confirm both files still export the same key set**

Run: `npm run typecheck`
Expected: PASS. (`MessageKey` is derived from `en.ts`; if `he.ts` is missing a key or has an extra
one, this project's locale-completeness check — confirm by grepping `he.ts`'s own type usage — will
catch it. If there's no automated key-parity check, visually diff the two new blocks line-by-line.)

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.ts src/i18n/he.ts
git commit -m "feat(sidebar-legend): add i18n content for sidebar legend"
```

---

### Task 3: `SidebarLegend` component — content table + panel UI

**Files:**
- Modify: `src/components/sidebar/SidebarLegend.tsx`

Builds the actual rendered panel: a static content table keyed by `SectionId`, and the
open/close/scroll UI. This task assumes Task 1's `SectionId` type and Task 2's i18n keys exist.

- [ ] **Step 1: Add the content table and component**

Append to `src/components/sidebar/SidebarLegend.tsx`:

```typescript
import { useEffect, useRef } from 'react'
import { useLocale } from '../../context/LocaleContext'

interface LegendLine {
  id: SectionId
  term: MessageKey
  desc: MessageKey
  /** Interpolation values for {noun}-style keys (select's variants only). */
  values?: Record<string, string>
}

/**
 * Static content, ordered for display. `select` appears three times (once per
 * view) with a different {noun} value each time rather than as one generic
 * line, so a user who jumps here from a specific view sees wording for THAT
 * view, not a blended generic sentence.
 */
function buildLines(t: (key: MessageKey, values?: Record<string, string>) => string): LegendLine[] {
  return [
    { id: 'company', term: 'sidebarLegend.companyTerm', desc: 'sidebarLegend.companyDesc' },
    { id: 'dateFilterRange', term: 'sidebarLegend.dateFilterRangeTerm', desc: 'sidebarLegend.dateFilterRangeDesc' },
    { id: 'dateFilterMonths', term: 'sidebarLegend.dateFilterMonthsTerm', desc: 'sidebarLegend.dateFilterMonthsDesc' },
    { id: 'dateFilterOpenOrders', term: 'sidebarLegend.dateFilterOpenOrdersTerm', desc: 'sidebarLegend.dateFilterOpenOrdersDesc' },
    { id: 'dateFilterStock', term: 'sidebarLegend.dateFilterStockTerm', desc: 'sidebarLegend.dateFilterStockDesc' },
    { id: 'view', term: 'sidebarLegend.viewTerm', desc: 'sidebarLegend.viewDesc' },
    { id: 'itemCategory', term: 'sidebarLegend.itemCategoryTerm', desc: 'sidebarLegend.itemCategoryDesc' },
    { id: 'select', term: 'sidebarLegend.selectTerm', desc: 'sidebarLegend.selectDesc', values: { noun: t('filters.clients') } },
    { id: 'showModeBreakdown', term: 'sidebarLegend.showModeBreakdownTerm', desc: 'sidebarLegend.showModeBreakdownDesc' },
    { id: 'showModeItems', term: 'sidebarLegend.showModeItemsTerm', desc: 'sidebarLegend.showModeItemsDesc' },
  ]
}

export function SidebarLegend({
  openSection,
  onOpenChange,
}: {
  /** `null` = closed. A SectionId = open and scrolled to that section. */
  openSection: SectionId | null
  onOpenChange: (next: SectionId | null) => void
}) {
  const { t } = useLocale()
  const panelRef = useRef<HTMLDivElement>(null)

  // Auto-open once ever, on mount, if never seen and not already controlled open.
  useEffect(() => {
    if (openSection === null && !hasSeenSidebarLegend()) {
      onOpenChange('company')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Scroll to the target section once the panel is in the DOM.
  useEffect(() => {
    if (!openSection || !panelRef.current) return
    const el = panelRef.current.querySelector(`[data-section="${openSection}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [openSection])

  function close() {
    onOpenChange(null)
    markSidebarLegendSeen()
  }

  const lines = buildLines(t)

  return (
    <>
      <button
        type="button"
        className="legend-btn"
        aria-expanded={openSection !== null}
        title={t('sidebarLegend.help')}
        onClick={() => (openSection !== null ? close() : onOpenChange('company'))}
      >
        ? {t('sidebarLegend.help')}
      </button>

      {openSection !== null && (
        <div
          ref={panelRef}
          className="legend-panel"
          role="region"
          aria-label={t('sidebarLegend.help')}
        >
          <div className="legend-hdr">
            <span>💡 {t('sidebarLegend.title')}</span>
            <button type="button" className="legend-close" onClick={close}>
              ✕
            </button>
          </div>

          <dl className="legend-terms">
            {lines.map(l => (
              <div key={l.id} data-section={l.id} className="legend-term-row">
                <dt>{t(l.term, l.values)}</dt>
                <dd>{t(l.desc, l.values)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </>
  )
}
```

**Before writing this, check the exact signature of `t()` in `useLocale()`** — the code above
assumes `t(key, values?)` supports interpolation (matching `sales.skewWarning`'s `{month}`/`{year}`
placeholders, per the spec). Read `src/context/LocaleContext.tsx` (or wherever `useLocale` is
defined) and `src/i18n/index.ts` to confirm the real signature and interpolation syntax before
copying this verbatim — adjust the `t(...)` calls to match if it differs (e.g. if interpolation
uses a different placeholder syntax than `{noun}`).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. If `t()`'s real signature doesn't accept a second `values` argument, this will fail
loudly here — fix the call sites to match the actual `useLocale` API before proceeding.

- [ ] **Step 3: Commit**

```bash
git add src/components/sidebar/SidebarLegend.tsx
git commit -m "feat(sidebar-legend): add legend panel UI with scroll-to-section"
```

---

### Task 4: Wire into `SidebarFilters.tsx` — main button + two inline triggers

**Files:**
- Modify: `src/components/sidebar/SidebarFilters.tsx`

- [ ] **Step 1: Add state and mount the main legend button**

In `SidebarFilters.tsx`, add near the top of the component body (after existing hook calls):

```typescript
import { SidebarLegend, type SectionId } from './SidebarLegend'
// ...
const [openLegendSection, setOpenLegendSection] = useState<SectionId | null>(null)
```

(Add `useState` to the existing `import { useLayoutEffect, useMemo } from 'react'` line — becomes
`import { useLayoutEffect, useMemo, useState } from 'react'`.)

Change the sidebar label block:

```tsx
<div className="sidebar-label-row">
  <div className="sidebar-label">{t('filters.global')}</div>
  <SidebarLegend openSection={openLegendSection} onOpenChange={setOpenLegendSection} />
</div>
```

Check whether `sidebar-label` already sits inside a flex row in the surrounding CSS — if
`.sidebar-label` isn't already flex-laid-out, add a minimal `.sidebar-label-row { display: flex;
align-items: center; justify-content: space-between; gap: 8px; }` rule to `legacy-theme.css` so the
button sits beside the label rather than wrapping awkwardly on narrow screens.

- [ ] **Step 2: Add the inline trigger next to the Tablet/Group toggle**

In the Items-view panel ④ block (`panel-title` "④ {t('filters.itemCategory')}"), change:

```tsx
<div className="panel-title">④ {t('filters.itemCategory')}</div>
```

to:

```tsx
<div className="panel-title-row">
  <div className="panel-title">④ {t('filters.itemCategory')}</div>
  <button
    type="button"
    className="legend-btn legend-btn-sm"
    title={t('sidebarLegend.help')}
    onClick={() => setOpenLegendSection('itemCategory')}
  >
    ?
  </button>
</div>
```

- [ ] **Step 3: Add the inline trigger after the Stock tab in the date-mode tab row**

In panel ②'s `tab-row`, after the `.map(tab => ...)` block closes, add one more button (not part of
the `DATE_TAB_KEYS.map`, since it isn't a tab):

```tsx
<div className="tab-row">
  {DATE_TAB_KEYS.map(tab => (
    /* ...unchanged... */
  ))}
  <button
    type="button"
    className="legend-btn legend-btn-sm"
    title={t('sidebarLegend.help')}
    onClick={() => setOpenLegendSection('dateFilterOpenOrders')}
  >
    ?
  </button>
</div>
```

- [ ] **Step 4: Add the `.legend-btn-sm` and `.panel-title-row` CSS**

Add to `src/styles/legacy-theme.css`, near the existing `.legend-btn` rule:

```css
.legend-btn-sm {
  padding: 2px 8px;
  font-size: 0.68rem;
  min-height: 22px;
  margin: 0;
}

.panel-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.panel-title-row .panel-title { margin: 0; }

/* So scrollIntoView doesn't tuck a legend section under the panel header. */
.legend-term-row { scroll-margin-top: 44px; }
```

Check the existing `.panel-title` rule's current margin before adding `.panel-title-row
.panel-title { margin: 0; }` — only needed if `.panel-title` has its own vertical margin that would
otherwise misalign the row.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/sidebar/SidebarFilters.tsx src/styles/legacy-theme.css
git commit -m "feat(sidebar-legend): wire legend button + two inline jump triggers into SidebarFilters"
```

---

### Task 5: Manual verification in the browser preview

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server preview and open the dashboard**

Use the project's existing dev server config (check `.claude/launch.json` for an existing entry, or
start `npm run dev` in the worktree and open the preview at its port). Log in as any user with
sidebar access.

- [ ] **Step 2: Confirm auto-open fires once**

Clear `localStorage` (or use a fresh private window), load the dashboard. The legend panel should
auto-open scrolled to the top (`company` section). Dismiss it with ✕. Reload the page — it should
NOT auto-open again.

- [ ] **Step 3: Confirm both inline triggers jump correctly**

Switch to Items view, click the small "?" next to "Tablet vs Group Category" — panel opens already
scrolled to that row (`itemCategory`), not the top. Click the small "?" next to the date-mode tab
row — panel opens scrolled to `dateFilterOpenOrders`.

- [ ] **Step 4: Confirm Hebrew (RTL) layout holds up**

Switch locale to Hebrew via the existing language switcher. Confirm the legend button doesn't
overlap the sidebar label, the panel-title-row buttons don't clip on narrow width, and the
scroll-to-section behavior still works (RTL doesn't affect `scrollIntoView` block targeting, but
confirm visually anyway).

- [ ] **Step 5: Take a screenshot for the record, then note results**

No commit needed for this task — it's verification only. If any step fails, fix the underlying
code (return to the relevant task above) and re-verify from Step 1.

---

## After all tasks

Dispatch a final code-reviewer subagent for the entire branch diff (`git diff main...HEAD`), then
use `superpowers:finishing-a-development-branch` to merge/PR/keep/discard, matching the pattern
already used for the class/permission admin tool branch this session.
