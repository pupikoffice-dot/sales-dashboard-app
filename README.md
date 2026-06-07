# Sales Dashboard App (React)

User-based sales dashboard with module permissions. See design spec:

`../docs/superpowers/specs/2026-06-07-user-based-sales-dashboard-design.md`

## Setup

1. Apply Supabase SQL from `../supabase/setup.sql` (see `../supabase/README.md`)
2. Copy `.env.example` to `.env.local`
3. Set **Sales Dashboard** Supabase URL + anon key (same project as step 1)
4. Set `VITE_DASHBOARD_DATA_URL` to your `data_loader.js` raw URL

## Dev

```bash
npm install
npm run dev
```

## Deploy (Vercel)

1. Import this folder as a Vercel project
2. Add env vars from `.env.example`
3. Deploy

## Super admin

- Log in with the user you promoted via `../supabase/bootstrap_super_admin.sql`
- Go to **Admin — Users** to assign module/company/agent checkboxes per user
