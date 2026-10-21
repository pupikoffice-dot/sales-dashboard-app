# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Four groups use one dashboard (all confirmed by the owner, 2026-10-20):
- **Owner / super admin**: sees every company; checks the whole group, on the phone and at a desk.
- **Managers**: see one or two companies and their agents (for example pupik + grow).
- **Sales agents**: see only their own customers and orders, mostly on the phone.
- **Office / operations staff**: stock, items, deliveries and purchasing, mostly at a desktop.

Main jobs: a **daily glance at the numbers** (orders today and this month, open orders, sales, returns, open debt), **digging into sales reports** (filter by client, item, supplier and dates, then export), and **stock and purchasing decisions** (stock by brand, items, purchase tracking in R&D). Managing users and permissions is a super-admin and admin job, not a daily one.

## Product Purpose
Management and sales dashboard for a small group of Israeli trading companies (Pupik, Monkeytime, Grow, Goldbug). It replaces a legacy Excel/VBA tower. Numbers come from the companies' own ERP exports, are loaded into a database about every hour, and are shown per person. Success is that each person trusts the number on screen, can reach it in seconds on a phone, and sees only what they are allowed to see.

## Positioning
One place across several companies, built on the group's own ERP reports and terminology, where what each person sees (companies, agents, sections, cost data) is decided per user and enforced by the database, not only hidden in the interface.

## Operating Context
- Data is Hebrew and English (item names, clients, categories); the interface switches between EN and Hebrew with right-to-left layout.
- Data freshness is part of using it: ERP exports run on a server PC on a schedule; the page shows when files were last updated and shows "Updating..." while newer data loads.
- First open on a phone is slow because the sales history is large (about 17 s measured after optimisation, reopen 4-5 s); speed on mobile is a standing concern.
- Two channels: a BETA site for trying changes and the production site people use. A super admin can preview any user's view ("View as").
- Cost and profit figures are restricted by default and only granted per user.

## Capabilities and Constraints
- Sections today: Oversight (company columns with Orders Today, Orders MTD, Open Orders, Sales MTD, Returns MTD, Open Debt, delivery notes; layouts Classic, Hub and a sales-manager/agent suite chosen per user), Sales (reports by client, item, supplier), Orders MTD, Open Orders, Operations (Deliveries, Stock, Stock by brand, Items), R&D (super admin only; Monthly data), Admin (users, classes, modules, data health).
- Per-user controls: companies, agents, which Oversight sections, which sidebar buttons, whether item cost is visible, and which look (skin) they may pick.
- Looks: Classic (default), Bento, Solid and Glass, each in light and dark.
- Built as a React + Vite + Tailwind app with Chart.js, on Supabase (database, login, row rules) and Vercel.
- Terminology to keep: Oversight, Open Orders, Sales MTD, Items, Stock by brand, R&D, "brand" meaning the supplier naming used on the Sales page.
- Open and undecided: whether Bento is distinct enough from Classic, a third skin, an icon-rail sidebar, Hebrew and phone checks under the Bento and Solid sidebars.

## Brand Commitments
No logo or brand guide has been provided. Company names (Pupik, Monkeytime, Grow, Goldbug) and the section names above are fixed. No other identity commitments are confirmed.

## Evidence on Hand
- Live production data for all four companies (hundreds of thousands of sales lines); no testimonials, customers or benchmarks exist and none may be invented.
- UI redesign kit with an elements file and screenshots of the current screens: `R:\Dropbox\03-18-2012\Pupik Operation\Biz-Dev\Projects\Codding\UI-redesign-kit\`.
- Project handoff and release notes: `\\srv\office\Biz-Dev\Projects\Codding\Management Dashboard\HANDOFF.md`.

## Product Principles
1. **A number must be trustworthy.** Show where and when it came from; a faster or prettier screen never changes a value.
2. **Show each person only what they may see.** Companies, agents, sections and cost are decided per user and never leak through a preview, a cache or a chart.
3. **The daily glance comes first, and it is a phone moment.** The most-used numbers load first and stay readable at a glance.
4. **Hebrew and English are equals.** Right-to-left is a full layout, not a mirrored afterthought.
5. **Depth on demand.** Summaries lead; item and client detail opens when asked, and can be exported.

## Accessibility & Inclusion
Hebrew and English with right-to-left layout are required. Light and dark themes exist. No formal accessibility standard (such as WCAG level) has been set; undecided.
