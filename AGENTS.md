# Management Dashboard: architecture and development rules

Shared instructions for every AI coding agent (Claude Code, Cursor, others). `CLAUDE.md` imports this file; edit rules **here**, once.
Also binding: `.cursor/rules/` (beta/main channel rule) and, on the server share, `Management Dashboard\CLAUDE.md` (ETL, PCs, release rules).

## Ground rules

- This is a **live company application** used daily by about 10 people. Modernise it **without disrupting operations**.
- **No big-bang rewrite. Ever.** Change one component at a time, keep the old one running until the new one is verified.
- Never deploy significant changes or touch production data without the owner's explicit approval ("push beta to production" is the approval phrase).
- All new work lands on the `beta` branch / BETA database. `main` = production only on explicit promotion (see `.cursor/rules/`).
- Back up / commit before significant migrations. Never delete the original implementation until the replacement is verified.

## Technology direction

- **TypeScript** for all new application code. Strict typing, small modules, explicit types at module boundaries.
- **Bun** is the preferred runtime/toolkit for **new** TypeScript services and scripts, but only after a compatibility check
  (dependencies, Windows, deployment target). Today the project runs on Node + npm + Vite + Vitest; do not switch the existing
  web app's toolchain until that check passes and the owner approves. Supabase Edge Functions run on Deno: leave them there.
- Frameworks: keep React 19 + Vite + TanStack Query + Supabase. Add libraries only for a concrete need; prefer TypeScript-native, well-maintained ones.
- **No new Python or Java** for new functionality without a written technical justification. (There is currently no Java in this project.)
- Modular by default: one responsibility per module, pure logic in `src/lib/` (unit-tested), UI in `src/components/`, pages in `src/pages/`,
  code shared with other apps in `shared/`. Keep files small and names explicit; that is what makes the code easy for AI agents to maintain.

## Gradual migration of existing code

Evaluate each component on its own. Migrate **only** when there is a meaningful advantage; never just to reach one language.
Before recommending any migration, assess and write down:

1. **Maintainability**: does TypeScript make it easier to maintain?
2. **Performance**: is there a *measured* advantage?
3. **Reliability**: does it reduce error risk or improve stability?
4. **Architecture**: does it simplify the whole system?
5. **AI development**: is it easier for agents to understand and change afterwards?
6. **Risk**: what could break, and how hard is it to reverse?

Do not migrate unless benefits clearly exceed cost and risk. Work that is correct and stable stays as it is.
Known keep-as-is areas: the Python ETL (`sync/`), the Windows UI-automation jobs (`ops/`, `jobs/`; `pywinauto` has no good TypeScript equivalent),
and database-side business logic (SQL/plpgsql engines such as `order_engine`).

## Hybrid architecture during the transition

Python, SQL and TypeScript coexist. Rules for the seams:

- Components talk only through **defined interfaces**: the Postgres schema and RPC functions, files with a documented format, or HTTP/edge functions. No component reaches into another language's internals.
- **One owner per business rule.** Never implement the same calculation twice (for example in SQL and again in TypeScript). If it must exist in two places, document the owner and add a parity test.
- Data shapes and validation rules are defined once (database constraints / shared types) and reused.
- **Protect the database**: schema changes only through a reviewed migration in `supabase/migrations/` (the only migration history), tested on BETA first, never edited by hand in production, never destructive without approval. Patch live functions with migrations, not ad-hoc SQL.
- Prefer additive, backward-compatible changes (new column/table/function) so the old and new code both keep working.

## Tables (permanent UI rule)

Every data table keeps its header row visible while the user scrolls down it. No exceptions for new tables.

- Wrap every table in the standard `.tw` wrapper (or one of the wrappers listed in `src/styles/tables.css`). That file makes the wrapper a scroll frame and sticks the whole `<thead>` to its top, with an opaque background. Do not add inline `overflow` / `overflowX` styles to a wrapper: they break it.
- A table opened inside another table's row needs no frame of its own; it sticks under the outer header (the outer table publishes `--tw-outer-head`, see `PlanTable`).
- Inside a modal the modal body is the scroll frame; the rule handles that.
- Sales report tables (`.tw-sticky`, `.tw-months`) use the older `useStickyTableHeaders` script. Leave them as they are.
- A table that can never be long (a legend, a fixed handful of rows) may stay without it; say so in a comment where it is built.
- A new table is not done until you have scrolled it in the browser and seen the header stay.

## Performance and scalability

Do not add infrastructure or optimise prematurely. Measure first (query timings, `explain analyze`, bundle size, render profiling), then fix the measured bottleneck.
Priorities: efficient queries and indexes, clean API/RPC design, caching only where measured, efficient rendering, secure auth (Supabase RLS + permission gates), and correct behaviour with several simultaneous users.
Language speed is not a reason to migrate.

## Workflow for every significant feature or migration

1. Inspect the relevant existing code. 2. Understand dependencies and business logic. 3. Explain the proposed change.
4. State the risks. 5. Implement incrementally. 6. Run tests (`npm test`, `npm run typecheck`; Python: `sync/tests`).
7. Verify existing behaviour still works (BETA site). 8. Update documentation (below).

## Documentation (keep current)

Maintain, in `docs/architecture/`: overall architecture, languages and frameworks, API/RPC interfaces, database structure, important dependencies,
migration progress, outstanding technical issues. Current baseline: `docs/architecture/ASSESSMENT-2026-11-17.md`.
Project state and session history live in `HANDOFF.md`; design context in `PRODUCT.md` / `DESIGN.md`.
When you change architecture or add a dependency, update the docs in the same change.
