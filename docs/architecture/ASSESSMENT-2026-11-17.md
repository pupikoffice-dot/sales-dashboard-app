# Architecture assessment: Management Dashboard (2026-11-17)

Status: **proposal for owner review. Nothing has been migrated or changed.**
Scope: the Management Dashboard platform (web app, mobile app, admin app, database, ETL, server jobs). Other projects in the Codding folder (B2B portal, Marketing Hub, Pixar kiosk, etc.) are out of scope.

## Summary

- The system is far more TypeScript than the brief assumed: **about 100% of the app code is already TypeScript**. There is **no Java** anywhere. Python exists only in the **data-loading robots** (ETL and ERP automation) that run on the server PC.
- The important business logic (forecast, order engine, permissions, aggregations) lives **in the Postgres database** as SQL/plpgsql, and that is a good place for it.
- So the real migration question is small: **very little should move**. The best investment is documentation, tests, type-sharing and tooling around what exists, not language conversion.
- Bun is a reasonable choice for **new** services and scripts, but not an upgrade worth forcing on the working web app now.

## A. Current architecture

### Languages (measured)
| Language | Where | Size | Role |
|---|---|---|---|
| TypeScript / TSX | `src/`, `admin-app/`, `mobile-app/`, `shared/`, `supabase/functions/`, `scripts/` | ~41,500 lines in the web app alone, 363 files, 56 test files | Everything users see; edge functions |
| SQL / plpgsql | `supabase/migrations/` | 135 migrations, 74 tables, 121 functions in production | Schema, security rules, business engines (order engine, aggregates, access gates) |
| Python | ETL `sync/` (~15,750 lines, 13 test files), ERP automation `ops/` + `jobs/` (~3,100 lines) | Server PC (smartpupik) | Reads ERP export files, loads the database; drives the legacy ERP window |
| PowerShell / BAT | `ops/`, `beta/ops/` | ~40 launchers | Scheduling and sequencing of ERP exports |
| Java | none | 0 | n/a |

### Frameworks and libraries
- **Web:** React 19, Vite 6, TanStack Query, React Router 7, Chart.js, Tailwind 3, `xlsx` (Excel export), Vitest + happy-dom.
- **Mobile:** Expo 51 / React Native 0.74 (sales team).
- **Admin app:** separate small Vite app, own Vercel project.
- **Shared:** `shared/` TypeScript helpers (some bundled for legacy use with esbuild).
- **ETL (Python):** pandas, openpyxl, xlrd/xlwt (old `.xls` ERP exports), supabase client, Google Drive client, `pywinauto` (Windows UI automation), pillow.

### Frontend / backend structure
- **No custom application server.** The browser talks directly to **Supabase** (Postgres + Auth + PostgREST + RPC). Security is enforced in the database (row-level security and permission-gate functions), not in a middle tier.
- Five **Supabase Edge Functions** (Deno, TypeScript, ~2,150 lines): `chat`, `dashboard-user-management`, `user-management`, `data-health-check`, `trigger-sync`.
- Heavy business logic is **database functions** called by name over RPC (for example `order_engine`, `get_item_card`, the dashboard page loaders).

### Database
- Supabase-hosted PostgreSQL, **two projects**: production ("OMEGA") and BETA. About 1.2 GB. Largest tables ~1M rows (`stock_daily`, `sales_lines`, `purchase_facts`).
- Extensions: pg_cron (3 jobs), pg_net, pgcrypto, vault, pg_stat_statements.
- Single migration history in git (`supabase/migrations/`), captured and reconciled on 2026-10-02.

### External integrations
- **Legacy ERP (NextERP/Finansit):** read through exported files plus Windows UI automation on a Windows PC. This is the data source of everything.
- Google Drive (file source), Vercel (hosting), GitHub (code + one promotion workflow), Supabase, an AI chat feature (edge function), Resend email (not yet working).

### Deployment
- Web/admin: Vercel. Production deploys from `main`; BETA is a manual beta-mode prebuilt deploy.
- Database changes: applied by hand to BETA first, then production.
- ETL/jobs: run on **smartpupik** (office PC) through a Windows task scheduler app; code lives on the office file share, not in git. A second "BETA" copy runs on the main PC.

## B. Migration opportunities

### Keep exactly as it is
- **Database logic (SQL/plpgsql).** The forecast and order engines belong next to the data; moving them to TypeScript would add a network hop, duplicate rules and slow things down.
- **ERP automation (`ops/`, `jobs/`, `pywinauto`).** It controls a legacy Windows program. TypeScript has no mature equivalent; a rewrite would only add risk.
- **React/Vite web app, mobile app, edge functions (Deno).** Already TypeScript. Edge functions must stay on Deno (Supabase's runtime).
- **Migrations folder and promotion process.**

### Could benefit from TypeScript (low priority, only if a need appears)
- `scripts/*.mjs` (7 small Node scripts): convert to `.ts` for type-checking. Trivial, low risk.
- **Shared types**: generate TypeScript types from the database (`supabase gen types`) so the web, mobile, admin and edge functions share one definition of the data. This is the largest practical TypeScript win and needs no migration of logic.
- Python ETL pieces that are **pure parsing/validation** (`excel_parser.py`, ~2,000 lines) are the only candidate for a later TypeScript port, and only if there is a measured reason (e.g. moving file ingestion into a Supabase edge/queue). Today it works, is tested, and uses pandas/xlrd which are strong for messy legacy Excel. **Recommendation: do not migrate.**

### Suitable for Bun
- **New** standalone TypeScript scripts/services (for example a future API layer, report generators, ingestion workers).
- The local developer toolchain (install, test runner) **after** a trial: Vite 6, Vitest and React work on Bun; the Expo/React Native mobile app is the one place Bun support is least proven.
- **Not** Supabase Edge Functions (Deno), and not the Vercel build until Vercel's Bun install support is tested with this lockfile.
- Windows note: Bun works on Windows, but the office PC and main PC both run Windows; test there before adopting for anything scheduled.

### Should stay in Python (or equivalent)
- ETL file ingestion and ERP automation, for the reasons above. Java: n/a.

## C. Recommended target architecture (5 to 10 years)

```
 ERP exports + ERP UI automation  (Python, Windows PC, unchanged)
              |  files (documented formats)
              v
      ETL loaders (Python)  ----writes----+
                                          v
                              Supabase Postgres  <-- single source of truth
                     schema + RLS + SQL business engines (RPC)
                                          ^
        generated TS types ---------------+
                                          |
   Web app (React/TS)   Mobile (Expo/TS)   Admin (TS)   Edge functions (Deno/TS)
                                          |
                    optional later: small Bun/TS API service for anything that
                    needs server-side logic outside the database
```

Principles: Postgres is the contract; Python writes data in, TypeScript reads and presents; each business rule has one owner; changes are additive and tested on BETA.

Stack to standardise: TypeScript strict, React + Vite, TanStack Query, Supabase, Vitest, generated DB types. Add Bun for **new** services after the compatibility check.

Infrastructure changes that may eventually be needed (not now): move ETL code under version control with its own repo or folder in git; a second Windows PC or a hosted runner as a fallback for the ERP jobs; scheduled database performance review as tables grow (the order engine already takes 8 to 17 seconds per company).

## D. Migration roadmap

| Stage | What | Depends on | Risk / effort | Benefit |
|---|---|---|---|---|
| 0 | Documentation baseline (this report, AGENTS.md/CLAUDE.md, architecture docs) | none | none / small | Agents and people share one picture |
| 1 | Generate TypeScript types from the database, use in web/mobile/admin/edge | 0 | low / small | Fewer data-shape bugs, better AI help |
| 2 | Put ETL (`sync/`, `ops/`) into git with CI running its 13 tests | 0 | low-medium (office share is live; copy, do not move) / medium | Versioning, review, rollback of the data pipeline |
| 3 | Measured performance pass: order engine speed, slow RPCs, bundle size | 0 | low / medium | Faster pages, based on measurements |
| 4 | Trial Bun for dev scripts and tests in a branch; compatibility report (Vercel, Windows, Expo) | 0 | low / small | Decide on facts; no production change |
| 5 | Convert `scripts/*.mjs` to TypeScript | 4 optional | very low / small | Consistency |
| 6 | Any new service (API, workers) built in TypeScript on Bun | 1, 4 | medium / depends on feature | Clean extension point |
| 7 | Re-evaluate ETL parser migration with real data (only if a measured reason exists) | 2, 3 | medium-high / large | Probably none; likely "no" |

## E. Immediate recommendations

**Do now**
- Adopt `AGENTS.md` + `CLAUDE.md` (done in this change, uncommitted for your review).
- Stage 1 (generated database types), after your approval.
- Put the ETL under git (Stage 2) so the data pipeline has history and tests in CI.

**Postpone**
- Switching the web app to Bun, until the trial (Stage 4) passes.
- Any ETL parser port to TypeScript.
- A separate API server: the database + RPC already serves that role.

**Do not change**
- The SQL business engines, the ERP automation jobs, the release process (beta first, promotion on your explicit say-so), the production database schema outside migrations.

## Outstanding technical issues noticed
- Order engine takes 8.6 s (Pupik) and 16.6 s (Monkeytime) per load; it relies on planner settings (`enable_nestloop off`, custom plans). Needs a measured performance pass.
- ETL code is outside git (office share), duplicated as `sync/` and `beta/sync/` by design; no CI.
- `.impeccable/` scratch files exist in `main` history only.
- Data-health email alerts never worked (no mail key).
- README is out of date (refers to `../supabase/setup.sql` and old paths); the real layout is in the server share's `docs/APP.md`.
- Edge function runtime (Deno) and the Node toolchain are different worlds; types are not shared with them yet.
