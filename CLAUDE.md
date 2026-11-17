# Claude Code instructions: Management Dashboard

@AGENTS.md

## Claude Code specifics

- Branch rule: new work goes on `beta` (see `.cursor/rules/`). Deploy BETA with a beta-mode build (`vite build --mode beta`, `vercel deploy --prebuilt`, alias set) and confirm the bundle contains the BETA Supabase ref, not the production one.
- Handoff protocol: the Codding root `CLAUDE.md` defines "write progress in HANDOFF.md" / "read HANDOFF.md". Offer a handoff after significant work.
- Runtime/ETL/ops rules (UNC paths, one PC per job, never edit `sync\` or `ops\` by hand, no secrets on the share) are in `Management Dashboard\CLAUDE.md` on the server share.
- Do not run the migrations in `docs/architecture/ASSESSMENT-2026-11-17.md` until the owner approves the roadmap.
