# Connecting real (or staging) data

**Step-by-step for a brand-new staging project:** see **[SETUP_STAGING_NOW.md](./SETUP_STAGING_NOW.md)** (copy-paste order).

Below is the same plan with more context.

## Phase 0 — Staging Supabase project

1. In [Supabase Dashboard](https://supabase.com/dashboard), **create a new project** (e.g. `sales-team-staging`). Use it for integration tests; keep production separate until you are confident.
2. Note **Project URL** and **anon key** (Settings → API).
3. Optionally create **production** only after staging sign-off.

## Phase 1 — Schema on that project

From this repo folder `Mobile App for salesteam/supabase`:

```bash
supabase link --project-ref YOUR_STAGING_REF
supabase db push
```

Or run SQL migrations manually in the Dashboard → SQL Editor (in filename order under `migrations/`).

## Phase 2 — Users (Auth + `user_profiles`)

Data-dependent behavior starts here; RLS keys off `user_profiles`.

1. **Super admin (first user)**  
   - Dashboard → Authentication → add user (email/password).  
   - SQL Editor: insert matching `user_profiles` row with `role = 'super_admin'`, same `id` as `auth.users.id`, `parent_id` null.  
   - Or use an existing bootstrap script if you add one later.

2. **Everyone else**  
   - Use **Sales Console** (admin-app) as `super_admin` / `admin`: **Users → New User** (Edge Function `user-management`). That creates Auth + profile + hierarchy.

3. Confirm in Dashboard: **Table Editor → `user_profiles`** matches who should log in.

## Phase 3 — Demo seed vs real ERP data

| Goal | What to run |
|------|-------------|
| UI / RLS smoke test | Run `20260405120000_seed_demo_data.sql` (and earlier seeds) **only on staging**. It uses fake `SEED-*` clients. |
| Real-shaped data | Run **`sync/`** (Python: Drive → Excel → Supabase). Copy `sync/.env.example` → `sync/.env`, add a **service account** JSON, **share the Drive folder** with that account’s email, set `GOOGLE_DRIVE_FOLDER_ID`. Run `python sync_to_supabase.py admin` or host **`sync/webhook_server.py`** and set Edge secret **`SYNC_WEBHOOK_URL`** (optional **`SYNC_WEBHOOK_SECRET`**; redeploy **`trigger-sync`**). Or import a **sanitized** CSV via SQL. |
| Production | Same migrations; **avoid** demo seed if it conflicts with real ERP IDs; use sync or controlled imports. |

Never run destructive demo deletes against production without checking `erp_client_id` / company keys.

### Client master — `acc101` exports (recommended)

Place these in the same Google Drive folder the sync reads (names are matched case-insensitively; `.xls` / `.xlsx`):

| File pattern   | Rows go to `clients.company` |
|----------------|------------------------------|
| `acc101pupik`  | `pupik`                      |
| `acc101grow`   | `grow`                       |
| `acc101mt`     | `mt` (Monkeytime in admin UI)|
| `acc101gold`   | `gold`                       |

**Layout:** Excel **row 1** = title row; **data from row 2.** Columns: **A** client #, **B** client name, **D** agent code, **F** address, **G** city, **H** phone, **I** fax. Parser: `sync/excel_parser.py` → `parse_clients_acc101`.

**Agent assignment:** column **D** is stored as `clients.erp_agent_id`. The DB trigger matches it to `user_profiles.agent_erp_id` (active agents) and sets `assigned_agent_id`. Set each field agent’s **ERP agent ID** in **Admin → Users** so codes line up.

Other client-style exports (`acc*`, `clients`, Hebrew לקוחות, etc.) still use header-based `parse_clients` if they do not contain `acc101`.

### Clients hard reset (acc101-only)

Use when you want a clean slate: **only** per-company `acc101*` files define `clients`; ignore legacy customer exports.

1. **Optional SQL wipe** (same effect as step 2b): Supabase → SQL Editor → run [`supabase/scripts/wipe_clients.sql`](../supabase/scripts/wipe_clients.sql) (`DELETE FROM public.clients;`).

2. **Sync options** (pick env and/or CLI):
   - `CLIENTS_SYNC_SOURCE=acc101_only` in `sync/.env` — skips non-acc101 `clients` file type (no download/parse for those files).
   - `CLIENTS_WIPE_AT_SYNC_START=1` — at the **start** of that sync run, deletes **all** `clients` rows via the service role, then processes the Drive folder. **Destructive** (manual assignments in admin are lost). Turn **off** after the rebuild run so cron/webhook never wipes production by accident.

   CLI equivalents (no env change):

   ```bash
   cd sync
   python sync_to_supabase.py admin --clients-acc101-only --wipe-clients-at-start
   ```

3. ** Preconditions:** `COMPANY_NAMES` must list every company you sync (include `gold` if you use `acc101gold`). Drive must contain the `acc101pupik` / `acc101mt` / `acc101grow` / `acc101gold` files you need.

4. **Verify:** Table Editor → `clients` counts by `company`; admin Dashboard / Clients as **admin** or **manager** (agents only see assigned rows).

## Phase 4 — Point the apps at staging

1. **Admin (Vite)**  
   - Copy `admin-app/.env.staging.example` → `admin-app/.env.staging`  
   - Fill URL + anon key.  
   - Run: `npm run dev` after copying values into `.env` **or** use a tool like `dotenv-cli` to load `.env.staging` (optional).

   Simplest: for a staging-only week, put staging values in `admin-app/.env` (and keep a backup of prod values elsewhere).

2. **Mobile (Expo)**  
   - Copy `mobile-app/.env.staging.example` → `mobile-app/.env.staging`  
   - Same project URL/key with `EXPO_PUBLIC_*` names.  
   - For local runs, either merge into `mobile-app/.env` or symlink; `app.config.js` loads `.env` from `mobile-app/`.

3. **Edge Functions**  
   - Deploy to the **same** project you linked: `supabase functions deploy` with staging secrets (`GEMINI_API_KEY`, service role only on server, etc.).

## Phase 5 — Verify connectivity

From `Mobile App for salesteam`:

```bash
node scripts/verify-supabase.mjs admin-app/.env
```

You should see `Auth health: 200`. If not, URL/key or network is wrong.

## Phase 6 — End-to-end checks (staging)

1. Admin: login → Dashboard counts → Users → Clients → Sync (if admin).  
2. Mobile: agent login → clients list → chat (needs AI secrets + data if you expect grounded answers).  
3. Fix RLS or policies **on staging** before touching production.

## Quick reference

- **Demo seed file:** `supabase/migrations/20260405120000_seed_demo_data.sql`  
- **User CRUD:** `supabase/functions/user-management` (JWT from logged-in admin/manager).  
- **Sync entry:** `supabase/functions/trigger-sync` + your Python/sync tooling.  
- **Clients (ERP):** `acc101pupik` / `acc101grow` / `acc101mt` / `acc101gold` in Drive → `parse_clients_acc101` (see Phase 3 above).

When staging passes these steps, repeat with a **production** project and production keys, without demo seed unless you intentionally want test rows.
