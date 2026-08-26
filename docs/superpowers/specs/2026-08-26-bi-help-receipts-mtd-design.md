# Design: BI cube help + Receipts Full report (MTD by client)

**Channel:** stable v2 (`main`) — production  
**Date:** 2026-08-26

## Goals

1. Add a clickable **?** next to Missed items, Missed clients, and Items sold by others titles. Click opens a popover with the product explanation (EN/HE).
2. Keep the Receipts **cube chart** unchanged. Change **Full report** so it shows **current month-to-date receipts aggregated by client** for the window’s agent scope (or All).

## Help UI

- Extend `BiCubeShell` with optional `helpText`.
- Small **?** button beside the title (left of BI badge). Click toggles a popover (reuse `.explain-popover` patterns). Outside click / Escape closes.
- Copy from product owner, localized in `en.ts` / `he.ts`.

## Receipts Full report

- Replace 12-month summary modal body with: table of **client ID, client name, cash (net of VAT)** for **current calendar month** (`collected_date` in MTD).
- Scope: company of the cube + agents of the window (`null`/empty = all agents already in access).
- New SECURITY DEFINER RPC `get_receipts_mtd_by_client(p_company text, p_agents text[] default null)` reading `receipt_lines`, gated like suite/super-admin receipts access.
- Modal loads on open via React Query; loading/empty/error states.

## Out of scope

- Changing the receipts cube stacked chart.
- Preloading all receipt lines into dashboard aux.
- Doc-level (per receipt) rows — by client only.
