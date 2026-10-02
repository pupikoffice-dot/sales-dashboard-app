# Staging setup — do these in order

Do this **once** when you create a new staging Supabase project.

## 1. Create the project (browser)

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → **New project**.
2. Save **Project URL** and **anon key** (Settings → API).

## 2. Point apps at staging (your PC)

1. **Admin:** copy `admin-app/.env.staging.example` → `admin-app/.env.staging`, fill URL + key.  
   - Easiest: copy those two lines into `admin-app/.env` while testing staging (backup old `.env` first if it was production).
2. **Mobile:** same with `mobile-app/.env.staging.example` → `mobile-app/.env` (or `.env.staging` merged manually).

## 3. Supabase CLI (do **not** use `npm install -g supabase` — it is not supported)

From **`Mobile App for salesteam`** (repo root), install the CLI into this repo:

```powershell
npm install
```

That adds a local `supabase` binary. Use it via **`npx`** or npm scripts, for example:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Or: `npm run supabase:link` / `npm run supabase:push` after `npm install`.

## 4. Link and push schema

From folder **`Mobile App for salesteam`** (after `npm install`):

```powershell
cd "R:\Dropbox\03-18-2012\Pupik Operation\Biz-Dev\Projects\Codding\Mobile App for salesteam"
npx supabase link --project-ref YOUR_PROJECT_REF
```

`YOUR_PROJECT_REF` is the short id in the project URL: `https://YOUR_PROJECT_REF.supabase.co`

Then:

```powershell
npx supabase db push
```

(Equivalent: `npm run supabase:link` then `npm run supabase:push` — you still pass `--project-ref` to link when using the script, so `npx supabase link ...` is clearer.)

This applies all files under `supabase/migrations/` in order.

## 5. Create the first Auth user

Dashboard → **Authentication** → **Users** → **Add user** → email + password → create.

Copy the new user’s **User UID** (UUID).

## 6. Attach `super_admin` profile

1. Open `supabase/scripts/bootstrap_super_admin.sql` in an editor.
2. Replace `PASTE_AUTH_USER_UUID`, email, and name.
3. Dashboard → **SQL Editor** → paste → **Run**.

## 7. Verify connectivity

From **`Mobile App for salesteam`** (repo root):

```powershell
npm run verify:supabase
```

Or from **`admin-app`** or **`mobile-app`** (each uses that folder’s `.env`):

```powershell
npm run verify:supabase
```

You should see `OK — staging/prod URL and anon key look valid.`

## 8. Optional demo data

Dashboard → SQL Editor → paste contents of `supabase/migrations/20260405120000_seed_demo_data.sql` → Run  
(Only on **staging**, not production with real ERP IDs.)

## 9. Deploy Edge Functions (for chat / sync / users)

With secrets set in Dashboard → **Edge Functions** → **Secrets** (`SUPABASE_SERVICE_ROLE_KEY` is automatic; add `GEMINI_API_KEY` etc.):

```powershell
supabase functions deploy user-management
supabase functions deploy chat
supabase functions deploy trigger-sync
```

Or one command from the repo root: `npm run supabase:deploy-functions`

## 10. Run admin locally

```powershell
cd admin-app
npm install
npm run dev
```

Open the printed URL → **Sign in** with the super_admin email → **Users**, **Clients**, etc.

## 11. ERP client files in Drive (when you run Python sync)

For **`clients`**, the recommended exports are **`acc101pupik`**, **`acc101grow`**, **`acc101mt`**, **`acc101gold`** (see [INTEGRATION.md](./INTEGRATION.md) → *Client master — acc101* for columns and agent matching). Put them in the Drive folder configured in `sync/.env` as `GOOGLE_DRIVE_FOLDER_ID`, then run `python sync_to_supabase.py admin` from `sync/`.

---

Full background: [INTEGRATION.md](./INTEGRATION.md)
