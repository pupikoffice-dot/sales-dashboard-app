# Sales Team Mobile App

A field-agent Android app that gives sales reps instant access to live ERP data through an AI chat interface, backed by a 4-tier admin hierarchy and a multi-provider AI backend.

---

## Architecture

```
ERP System
    │ (auto-refreshed Excel files)
    ▼
Google Drive Folder (synced from office server)
    │
    │ [Python Sync Script — sync/]
    ▼
Supabase Database (PostgreSQL + Auth)
    │  - user_profiles (super_admin / admin / manager / agent)
    │  - clients, sales_lines, inventory, sku_pricing
    │  - sync_logs, app_settings, agent_devices, query_logs
    ▼
Supabase Edge Functions
    │  - chat  (AI router: Gemini / Claude / OpenAI — reads app_settings)
    │  - trigger-sync  (manual sync trigger)
    ▼
┌──────────────────────┐    ┌────────────────────────────┐
│  Admin Web App       │    │  Mobile App (React Native) │
│  admin-app/          │    │  mobile-app/               │
│  Vite + React + TS   │    │  Expo + TypeScript         │
└──────────────────────┘    └────────────────────────────┘
```

---

## Role Hierarchy

```
Super Admin (you)
    └── Admin
            └── Manager
                    └── Agent
```

- **Super Admin** — full visibility; creates admins; controls all settings
- **Admin** — creates managers; sees all data under them
- **Manager** — creates agents; sees all their agents' client data
- **Agent** — sees only their own assigned clients

Enforced at Supabase RLS level via `parent_id` in `user_profiles`. No application-level trust.

---

## AI Provider

Default: **Gemini Flash 2.0** (cheapest, excellent Hebrew support).

Switch to Claude or OpenAI any time from the Admin → AI Settings page. Agents are completely unaware of which provider is active — the mobile app only talks to the `chat` Edge Function.

All API keys are Supabase Edge Function secrets. Never stored in code or the device.

---

## Security Model

The mobile app contains **no secrets**. Even with the full source code + APK, an attacker cannot read any data without a valid registered email + password.

- Supabase anon key is public by design (protected by RLS policies)
- Service role key and AI API keys live only in Edge Functions
- Hermes bytecode (auto with Expo) — APK bundle is compiled binary
- Metro minifier with `drop_console` and `mangle: toplevel`
- ProGuard / R8 enabled via `expo-build-properties`
- No offline data cache — zero client records stored on device
- Device registry — every device logs on first login
- Remote revocation — admin can block a stolen device (takes effect within 1 JWT refresh cycle)

---

## Project Structure

```
Mobile App for salesteam/
├── README.md
│
├── supabase/
│   ├── migrations/
│   │   └── 20260404000000_initial_schema.sql   ← Run in Supabase SQL editor
│   └── functions/
│       ├── chat/index.ts                        ← AI multi-provider router
│       └── trigger-sync/index.ts               ← Manual sync trigger
│
├── sync/                                        ← Python sync script
│   ├── sync_to_supabase.py
│   ├── google_drive_client.py
│   ├── excel_parser.py
│   ├── requirements.txt
│   └── .env.example
│
├── admin-app/                                   ← Web admin console
│   ├── package.json
│   ├── .env.example
│   └── src/
│       ├── pages/
│       │   ├── LoginPage.tsx
│       │   ├── DashboardPage.tsx
│       │   ├── UsersPage.tsx       ← 4-tier user hierarchy
│       │   ├── ClientsPage.tsx     ← Client-agent assignments
│       │   ├── SyncPage.tsx        ← Sync history + manual trigger
│       │   ├── SettingsPage.tsx    ← AI provider + model + limits
│       │   ├── UsagePage.tsx       ← Per-agent query usage + cost
│       │   └── SecurityPage.tsx    ← Device registry + revocation
│       └── ...
│
└── mobile-app/                                  ← Android app
    ├── package.json
    ├── app.json
    ├── eas.json
    ├── metro.config.js
    ├── .env.example
    ├── app/index.tsx
    └── src/
        ├── screens/
        │   ├── LoginScreen.tsx
        │   ├── ChatScreen.tsx          ← Main AI chat interface
        │   ├── ClientListScreen.tsx    ← Assigned clients
        │   ├── ClientDetailScreen.tsx  ← Sales history (read-only)
        │   └── AgentListScreen.tsx     ← Manager view: see all agents
        ├── navigation/AppNavigator.tsx
        ├── context/AuthContext.tsx     ← Auth + device registration
        └── lib/
            ├── supabase.ts
            └── deviceInfo.ts
```

---

## Setup Instructions

### 1. Supabase Schema

1. Create a new Supabase project (separate from B2B portal)
2. In Supabase Dashboard → SQL Editor, run:
   `supabase/migrations/20260404000000_initial_schema.sql`
3. **Optional — demo rows from this repo** (matches Dashboard `ExportDashboardData.bas` field meanings): run  
   `supabase/migrations/20260405120000_seed_demo_data.sql`  
   Creates clients `SEED-PUP-001`, `SEED-MT-001`, `SEED-G-001`, sample `sales_lines`, `inventory`, `sku_pricing`.  
   If an **active agent** already exists in `user_profiles`, they are auto-assigned; otherwise assign in **Admin → Clients**.  
   You can run this file again anytime in SQL Editor (it deletes old seed sales lines for those client IDs, then re-inserts).
4. In Edge Functions → Secrets, add:
   - `GEMINI_API_KEY` — from [aistudio.google.com](https://aistudio.google.com)
   - `CLAUDE_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)
   - `OPENAI_API_KEY` — from [platform.openai.com](https://platform.openai.com)
   - `SYNC_WEBHOOK_URL` (optional) — URL to call when sync is triggered

### 2. Deploy Edge Functions

```bash
supabase functions deploy chat
supabase functions deploy trigger-sync
supabase functions deploy user-management
```

`user-management` mirrors the B2B `admin-user-management` pattern: it creates/deletes **Supabase Auth** users and **`user_profiles`** rows from the Sales admin console (with hierarchy checks).

**If create/delete returns HTTP 401 / “Invalid JWT”:** In Supabase Dashboard → Edge Functions → **user-management** → disable **Verify JWT** (the function still checks the bearer token inside the code). When using the CLI, `supabase/config.toml` already sets `verify_jwt = false` for `user-management`, `chat`, and `trigger-sync` — redeploy after pulling the repo.

### 3. Create Super Admin

After running the schema, create yourself in Supabase Auth (Dashboard → Authentication → Users), then run:

```sql
INSERT INTO user_profiles (id, email, name, role)
VALUES ('<your-auth-user-id>', 'your@email.com', 'Your Name', 'super_admin');
```

### 4. Admin Web App

```bash
cd admin-app
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Deploy to Vercel: connect the `admin-app` folder, set the two env vars.

### 5. Python Sync Script

```bash
cd sync
pip install -r requirements.txt
cp .env.example .env
# fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_DRIVE_FOLDER_ID
# place service_account.json in the sync/ folder

python sync_to_supabase.py cron
```

Schedule in Windows Task Scheduler to run every 15–30 minutes.

**File naming convention for auto-detection:**
- Sales files: must contain `מכירות` or `sales` in filename
- Inventory files: must contain `מלאי`, `inventory`, or `wms`
- Pricing files: must contain `מחירון` or `price`
- Company: must contain `pupik`, `mt`, or `grow` in filename

### 6. Mobile App

```bash
cd mobile-app
cp .env.example .env
# fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npm run android   # for development
```

### 7. Build APK

Ensure `mobile-app/.env` has **`EXPO_PUBLIC_SUPABASE_URL`** and **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** (baked into the JS bundle at build time).

#### Option A — Local APK file (no Expo cloud, no EAS account)

You get a single **`.apk`** on disk to upload to Drive / shared link.

**Prerequisites (one-time on the PC that builds):**

- [Android Studio](https://developer.android.com/studio) (includes Android SDK). In SDK Manager, install a recent **Android SDK** + **SDK Build-Tools**.
- Set environment variable **`ANDROID_HOME`** to your SDK path (e.g. `C:\Users\You\AppData\Local\Android\Sdk`).
- **JDK 17 (64-bit)** — Gradle 8 + React Native will fail if Windows picks an old **32-bit Java 8** (`Program Files (x86)\Java\...`). Set **User** variable **`JAVA_HOME`** to Android Studio’s bundled runtime, e.g. `C:\Program Files\Android\Android Studio\jbr` (folder must contain `bin\java.exe`). Open a **new** terminal and run `where java` — the first path should be under that `jbr\bin`, not `x86\Java`.

**Build (Windows, from repo root):**

The `android/gradle/wrapper/` folder must contain **`gradle-wrapper.jar`** (tracked in git). If `gradlew` fails with `GradleWrapperMain` missing, restore that folder from git or re-run `npx expo prebuild --platform android` from `mobile-app`.

If `java -version` still shows **1.8** in CMD, set JDK for this session before Gradle:

```cmd
set JAVA_HOME=R:\android studio\jbr
```
(adjust path to your `jbr` folder), then run the commands below.

```bash
cd mobile-app
npm install
npm run build:apk:local
```

Output file:

`mobile-app/android/app/build/outputs/apk/debug/app-debug.apk`

Share that file however you like. On tablets: enable **Install unknown apps** for your browser or Files app, open the APK.

Re-run **`npm run android:prebuild`** if you change native config; re-run **`npm run android:apk:debug`** to rebuild only the APK (after the first successful prebuild).

On macOS/Linux, use `cd android && ./gradlew assembleDebug` instead of `gradlew.bat` (or add a small shell script).

#### Option B — Expo EAS (cloud build)

Requires an Expo account and `eas login`. See `eas.json` profile **`preview`** (`buildType: "apk"`). Run `npm run build:apk` from `mobile-app`, then download the `.apk` from the build page on [expo.dev](https://expo.dev).

---

## Cost Estimate (4 agents + 1 manager, 500 queries/agent/month)

| AI Provider | Model | Cost/month (est.) |
|-------------|-------|-------------------|
| **Gemini** (default) | Flash 2.0 | ~$0.05 |
| Claude | Haiku 4.5 | ~$0.40 |
| OpenAI | GPT-4o Mini | ~$0.08 |

Supabase free tier covers the database for this scale. Upgrade ($25/month) if you hit row limits or need more Edge Function invocations.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Mobile App | React Native + Expo (TypeScript) |
| Backend / Auth | Supabase (PostgreSQL + Auth + Edge Functions) |
| AI | Gemini / Claude / OpenAI (switchable) |
| Data Sync | Python + Google Drive API |
| Admin Console | Vite + React + TypeScript + Tailwind |
| APK Build | Expo EAS Build |

---

*Last updated: April 2026*
