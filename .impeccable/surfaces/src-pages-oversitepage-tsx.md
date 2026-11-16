---
version: 1
slug: "src-pages-oversitepage-tsx"
primary_target: "src/pages/OversitePage.tsx"
related_targets: ["src/styles/skin-glass.css"]
---

# Oversight home screen: Glass skin

## Scope and mode
Surface: the Oversight home screen and the shared shell (header, sidebar, panels, tables, buttons) as one selectable **skin** named Glass, next to Classic, Bento and Solid in the header Look menu. Mode: Operate. It ships as a CSS layer keyed on `html[data-skin='glass']`; it must work in the dark and light themes and in Hebrew right-to-left. BETA only until the user approves production.

## Audience, job, action
Owner, managers, sales agents and operations staff; the daily glance at orders, sales, open orders, returns and debt, mostly on a phone. Constraints: existing markup and behaviour stay as they are; no new content; the other skins are untouched; Classic remains the default.

## Chosen direction
Edge-lit Glass Shelf, chosen by the user from the round 2 decision page. Dark first, with a light scheme.

## Unresolved decisions
Freshness line-form and struck returned lines need state classes from the data layer first. The emoji in titles are existing markup; the skin renders them as text glyphs where the browser supports `font-variant-emoji`.
Hub layout and the Sales Manager suite are styled through the shared tokens and panel classes; per-page polish beyond Oversight, Sales and the tables is for later rounds.

## Direction contract
THESIS: Dark smoked-glass panels, each lit from its top edge by one thin line of its company's colour; a screen with no boxes-on-boxes and no heavy fills, where hairlines and light do the dividing. It refuses the default arrangement of same-weight cards on a flat tint.
OWN-WORLD: Near-black ground (#07090d dark; pale grey #eef1f5 light), glass panels one step lighter with 1px seams, panel top edge lit by the company colour fading downward (periwinkle for Pupik, teal for Monkeytime, amber for Grow, gold for Gold). Humanist grotesque with tabular figures, light-weight large numerals, small uppercase labels. Rank by weight and case, not extra colours. Display figures and the page title are light weight.
STORY: In a few seconds the visitor sees which company is which by its edge light and reads the cash figure first. (Freshness as line form was dropped: the existing markup exposes only a 'Synced' text, no live, pending or stale state to style.)
FIRST VIEWPORT: Hairline header with a pill Look/language row; the existing sidebar with a tinted-pill active item marked by an accent dot; the page title in light weight; two glass panels side by side, each with its coloured top edge and its section title (company name as a heading above the panel), a three-cell hairline KPI row with the cash figure in the company colour, then a hairline table (no box of its own inside the panel) and the existing horizontal bars restyled as 10px tracks.
FORM: Edge-lit Glass Shelf, assigned grounded direction 7 of the re-roll (round 2). seed:539f286eb91e585c
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
