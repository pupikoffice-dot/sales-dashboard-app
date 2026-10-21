---
name: Sales Dashboard (Glass skin)
description: The opt-in Glass look for the Sales Dashboard, a seamed, edge-lit dark (and light) layer on top of the Classic base.
colors:
  glass-bg: "#07090d"
  glass-surface: "#0e131b"
  glass-surface-inset: "#0a0e14"
  glass-surface-raised: "#161d28"
  glass-surface-strong: "#121924"
  glass-surface-weak: "#0b1017"
  glass-seam: "rgba(255, 255, 255, 0.07)"
  glass-seam-strong: "#232c3a"
  glass-text: "#f2f5fa"
  glass-text-soft: "#c4ccd9"
  glass-text-muted: "#8d97ab"
  accent: "#7aa2ff"
  accent-deep: "#5b86f0"
  accent-wash: "rgba(122, 162, 255, 0.12)"
  on-accent: "#06080c"
  positive: "#5fd38d"
  warning: "#f0b04a"
  negative: "#ff7b7b"
  company-pupik: "#7aa2ff"
  company-monkeytime: "#4fd1c5"
  company-grow: "#f0b04a"
  company-goldbug: "#e3c85c"
  chart-violet: "#c792ea"
  light-bg: "#eef1f5"
  light-surface: "#ffffff"
  light-surface-inset: "#f6f8fb"
  light-surface-raised: "#e8ecf2"
  light-seam: "rgba(15, 23, 42, 0.09)"
  light-seam-strong: "#d3dae4"
  light-text: "#0f172a"
  light-text-soft: "#334155"
  light-text-muted: "#5b6678"
  light-accent: "#3a5fd0"
  light-accent-deep: "#2c4cb4"
  light-on-accent: "#ffffff"
  light-positive: "#0f7a52"
  light-warning: "#a15c00"
  light-negative: "#c0392b"
  light-company-monkeytime: "#0b7a71"
  light-company-grow: "#a35f00"
  light-company-goldbug: "#8a6d00"
  light-chart-violet: "#8e44ad"
typography:
  display:
    fontFamily: "Hanken Grotesk, Rubik, Segoe UI, system-ui, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 300
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  figure:
    fontFamily: "Hanken Grotesk, Rubik, Segoe UI, system-ui, sans-serif"
    fontSize: "clamp(1.2rem, 5.4vw, 1.7rem)"
    fontWeight: 400
    lineHeight: 1.1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title:
    fontFamily: "Hanken Grotesk, Rubik, Segoe UI, system-ui, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 500
    letterSpacing: "0.01em"
  body:
    fontFamily: "Hanken Grotesk, Rubik, Segoe UI, system-ui, sans-serif"
    fontWeight: 400
    fontFeature: "tnum"
  label:
    fontFamily: "Hanken Grotesk, Rubik, Segoe UI, system-ui, sans-serif"
    fontSize: "0.68rem"
    fontWeight: 500
    letterSpacing: "0.12em"
rounded:
  bar: "5px"
  nav: "8px"
  panel: "18px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  gutter: "22px"
components:
  pill-control:
    backgroundColor: "transparent"
    textColor: "{colors.glass-text-soft}"
    rounded: "{rounded.pill}"
    padding: "6px 16px"
    height: "32px"
  pill-control-active:
    backgroundColor: "{colors.glass-text}"
    textColor: "{colors.glass-bg}"
    rounded: "{rounded.pill}"
  pill-control-hover:
    backgroundColor: "{colors.glass-surface-raised}"
    textColor: "{colors.glass-text}"
  apply-button:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.glass-text-soft}"
    rounded: "{rounded.nav}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "{colors.glass-surface-raised}"
    textColor: "{colors.glass-text}"
  panel:
    backgroundColor: "{colors.glass-surface}"
    rounded: "{rounded.panel}"
    padding: "16px 20px 14px"
  field:
    backgroundColor: "{colors.glass-surface-inset}"
    textColor: "{colors.glass-text}"
  bar-track:
    backgroundColor: "{colors.glass-surface-raised}"
    rounded: "{rounded.bar}"
    height: "10px"
---

# Design System: Sales Dashboard, Glass skin

## Overview

**Creative North Star: "The Edge-Lit Shelf"**

Glass is one opt-in look of a multi-skin product. The app has four looks (Classic, Bento, Solid, Glass), picked per person from the Look menu in the header and limited per user by an admin. **Classic is the default and is untouched**; it owns the markup, layout, class names, behaviour and the base token set (`legacy-theme.css`). Glass is a CSS layer that applies only when the page root carries the `glass` skin attribute. Nothing here describes the identity of the whole app, and new work must not assume Glass is what users see.

What Glass changes is the surface, not the structure. Smoked-glass panels sit on a near-black ground, divided by 1px seams. Each Oversight panel is lit along its top edge by one thin line in its company's colour, fading down into the glass, so a person tells Pupik from Monkeytime by light rather than by a heavier box. Hairlines and light do the dividing; nothing is blurred, shadowed or filled heavily, and a table inside a panel keeps only its row hairlines. Rank comes from weight, case and size, not from extra colours. The light scheme keeps the same structure on pale grey with white panels.

**Key Characteristics:**
- One skin among four; Classic stays default and is the base Glass is layered on.
- Seams over fills: 1px hairlines everywhere, no blur, no panel shadow.
- One coloured edge light per company panel; company colour is the only colour that ranks.
- Light-weight large figures with tabular numerals; small spaced uppercase labels.
- Pill-shaped hairline controls; the selected one inverts to text-on-background.
- Dark first, with a real light scheme; both flip right-to-left without separate rules.

**What Glass inherits from Classic:** every element and class name, the grid and column structure, the 60px header and sidebar widths, breakpoints, the panel radius (18px), chart and bar structure, spacing not listed below, and all behaviour (data, permissions, language switch, preview, export). Chart.js series colours are driven through the chart tokens.

**What Glass overrides:** the colour tokens (dark and light), the typeface, header and sidebar chrome (flat, hairline, no blur), panels, status bar, summary cubes and login card (seamed, no shadow), tables (hairlines only), controls (pills), the Oversight section (edge light, hairline KPI row, 10px bar tracks), and the focus and selection colours.

## Colors

A cool blue-black ground with a periwinkle accent in dark; a pale grey ground with a deeper cobalt accent in light. Values are the Glass tokens set under the skin; in light the same token names take the `light-` values in the frontmatter.

### Primary
- **Periwinkle** (`accent`; light: `light-accent` cobalt): focus ring, text selection tint (38%), the active-nav dot, the Apply button fill, the fallback edge-light colour when a panel has no company, and the Pupik colour.
- **Deep Periwinkle** (`accent-deep`; light: `light-accent-deep`): the pressed/secondary accent step inherited by Classic components.

### Secondary
- **Company colours** (`company-pupik`, `company-monkeytime`, `company-grow`, `company-goldbug`; light variants darkened to hold contrast on white): Pupik periwinkle, Monkeytime teal, Grow amber, Goldbug gold. They drive each panel's top edge, its company dot, and the cash figure in that panel's KPI row.
- **Signal colours** (`positive`, `warning`, `negative`; light variants deepened): sign and status in deltas and bars. Chart series run periwinkle, green, amber, red, teal, then violet (`chart-violet`).

### Neutral
- **Smoked Ground** (`glass-bg`; light `light-bg`): page and header ground.
- **Glass Panel** (`glass-surface`; light `light-surface`): panel, status bar, cube and table fill. `glass-surface-strong` and `glass-surface-weak` are one step up and down for subtle rows and headers.
- **Inset** (`glass-surface-inset`; light `light-surface-inset`): inputs, selects and search.
- **Raised** (`glass-surface-raised`; light `light-surface-raised`): hover and active nav, bar tracks.
- **Seams** (`glass-seam` for resting hairlines, `glass-seam-strong` for control borders and table header rules).
- **Text** (`glass-text` primary, `glass-text-soft` for controls and nav, `glass-text-muted` for labels and sync notes).

### Named Rules
**The One Edge Rule.** A panel carries a single colour: its company's top-edge line (2px, fading down over about 72px at 15% dark, 7% light). Do not add a second tint, border colour or fill to it.

**The Seam Rule.** Division is a 1px hairline. If two things need separating, use a seam or space, never a shadow, blur or heavier fill.

## Typography

**Display, Body and Label Font:** Hanken Grotesk (weights 300, 400, 500, 600), then Rubik, Segoe UI, system sans.

**Character:** A humanist grotesque with tabular figures everywhere, so columns of cash and quantities align. Hanken Grotesk is loaded lazily, only once the Glass skin is shown, so other-skin users never download it. It has no Hebrew glyphs, so Hebrew text falls through to Rubik, which the app loads globally. Classic uses Inter then Rubik.

### Hierarchy
- **Display** (300, 1.9rem, -0.01em): the page title on Oversight. Light weight is the point.
- **Figure** (400, clamp(1.2rem, 5.4vw, 1.7rem), 1.1, -0.02em): KPI values; the cash figure takes the company colour.
- **Title** (500, 1.05rem, 0.01em): company column headers; header app title is 500 with 0.01em.
- **Body** (400, tabular numerals): table cells and general text; selected controls and totals go to 600.
- **Label** (500, 0.68rem, 0.12em, uppercase): table headers; KPI labels share the 0.12em spacing. Section titles, sidebar labels and panel titles use 0.14em spacing in muted text.

### Named Rules
**The Light Numerals Rule.** Big figures and the page title are light or regular weight; weight 600 is for selection and totals only.

**The Text Glyph Rule.** Existing emoji in titles and nav are rendered as text glyphs where the browser supports it (`font-variant-emoji: text`). They are carried-over markup, not part of the skin's language.

## Layout

Glass does not change the layout; it follows Classic. Oversight is a two-column grid (22px gap, columns top-aligned) that drops to one column at 900px; the sidebar keeps its Classic width (290px) and becomes a fixed drawer on narrow screens; the header is 60px. Glass tightens the sidebar item gap to 12px and the panel padding to 16px 20px 14px. KPI cells sit in one hairline row (three cells, 12px 14px 10px padding), divided by inline-start hairlines. Spacing rhythm in use: 6, 8, 12, 16, 20, 22px.

Right-to-left is a full flip, not a mirror: columns reverse, the sidebar moves to the right, the nav dot and company dot use inline margins, cell dividers use inline-start borders, KPI text aligns to start. Signed percentages are isolated left-to-right so the sign stays left of the digits.

## Elevation & Depth

Flat and seamed. Panels, header, sidebar, tables and controls have no box-shadow and no backdrop blur; depth is a one-step tonal change (ground, panel, raised) plus the edge light. The only shadow is the floating login card and overlays (`0 14px 40px rgba(0,0,0,0.6)` dark; `0 12px 32px rgba(15,23,42,0.12)` light).

### Named Rules
**The No-Blur Rule.** Glass is a name for the look, not a technique. Header and sidebar are opaque and the skin turns Classic's blur off.

## Shapes

Panels keep Classic's 18px radius. Controls are full pills (999px); the month and year pickers and the sidebar items are 8px; progress bar tracks and fills are 10px tall with 5px ends. Company dots (8px) and the active-nav dot (6px) are circles. A table inside a panel has no border or radius of its own.

## Components

### Buttons and pills
- **Shape:** full pill (999px), 32px minimum height, padding 6px 16px; month/year buttons 8px.
- **Rest:** transparent, 1px strong seam, soft text.
- **Hover:** raised fill, border brightens to muted, text to full.
- **Selected:** inverts to full-text fill with ground-coloured text, weight 600. Applies to buttons, tabs and the language switch.
- **Apply:** the one filled colour, accent fill with dark text, weight 600.
- **Focus:** 2px accent outline, 2px offset, on everything.

### Inputs / Fields
Inset fill, 1px strong seam, full-text colour, no shadow. The Look menu is a transparent pill with a borderless select.

### Navigation
Sidebar items are 8px-radius, transparent, soft text, 8px 12px padding. Hover and active take the raised fill; active adds a strong seam, weight 600 and a 6px accent dot before the label. Group labels are small muted uppercase with wide tracking.

### Panels / Containers
Glass panel fill, 1px seam, 18px radius, no shadow. In the sidebar, panels are transparent.

### Oversight panel (signature)
Panel with a 2px company top edge and a 72px fading tint beneath it; a muted spaced uppercase section title and a muted "Synced" note; then the hairline KPI row, a hairline table with no box of its own, and 10px bar tracks. The company heading sits above the panel as plain text with an 8px company-colour dot.

### Tables
Transparent header with muted uppercase labels over a strong seam; rows divided by hairlines, no zebra; row hover is a faint accent wash; footers take a strong top seam and weight 600; numerals are tabular.

## Do's and Don'ts

### Do:
- **Do** treat Glass as one skin: scope every rule to the Glass skin attribute and leave Classic and the other skins unchanged.
- **Do** drive colour through the theme tokens so dark, light and right-to-left follow without extra rules.
- **Do** use the company colour for the edge light, company dot and cash figure, and nowhere else on that panel.
- **Do** use inline-start/end properties and logical margins for anything directional.
- **Do** keep numerals tabular and large figures light.

### Don't:
- **Don't** add shadows, blur or heavy fills to panels, header or sidebar.
- **Don't** put a box inside a panel; a table or KPI row inside a panel is hairlines only.
- **Don't** introduce a second accent or per-element tints to rank things; use weight, case and size.
- **Don't** describe Glass as the app's brand or let it change content, markup, class names or behaviour.

## Not canonized

Carried by the build but not rules for future surfaces: emoji icons in titles and nav (existing markup, shown as text glyphs where supported), and the deferred freshness line-form (needs state classes from the data layer).
