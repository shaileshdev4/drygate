# Deployment Guide

## Stack


| Service     | Provider                 | Notes                                       |
| ----------- | ------------------------ | ------------------------------------------- |
| Next.js app | Railway (Service 1)      | Nixpacks build, auto-deploy from GitHub     |
| n8n sandbox | Railway (Service 2)      | Docker image `n8nio/n8n:0.236.2`            |
| Database    | Supabase (free Postgres) | Connection string passed via `DATABASE_URL` |


---

## Steps

### 1. Supabase — create Postgres database

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **Settings → Database → Connection string**
3. Select **Transaction pooler** URI (safer for serverless)
4. Copy — this becomes your `DATABASE_URL`

---

### 2. Railway — n8n sandbox service

1. **New project → Add Service → Docker Image** → enter `n8nio/n8n:0.236.2`
2. Set these environment variables on the service:
  ```
   N8N_BASIC_AUTH_ACTIVE=true
   N8N_BASIC_AUTH_USER=drygate
   N8N_BASIC_AUTH_PASSWORD=drygate-sandbox-pw
   N8N_USER_MANAGEMENT_DISABLED=true
   EXECUTIONS_DATA_SAVE_ON_SUCCESS=all
   EXECUTIONS_DATA_SAVE_ON_ERROR=all
   EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=true
   N8N_DIAGNOSTICS_ENABLED=false
   N8N_LOG_LEVEL=warn
  ```
3. **Add a volume**: mount path `/home/node/.n8n` (persistent workflow + execution storage)
4. Note the **internal Railway URL**, e.g.:
  `http://drygate-n8n-sandbox.railway.internal:5678`
   — this is what you pass as `SANDBOX_N8N_URL` to the Next.js service

---

### 3. Railway — Next.js app service

1. **Add Service → Deploy from GitHub repo** (select your repo)
2. Railway detects `railway.toml` and runs:
  - Build: Nixpacks
  - Start: `npx prisma db push && npm run start` (schema auto-migrated on every deploy)
3. Set **all env vars** from `.env.production.example`:
  ```
   NEXT_PUBLIC_APP_URL=https://your-app.railway.app
   DATABASE_URL=<supabase connection string>
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
   CLERK_SECRET_KEY=sk_live_...
   SANDBOX_N8N_URL=http://drygate-n8n-sandbox.railway.internal:5678
  ```
  > **Schema note:** The codebase uses `provider = "postgresql"` for everything (no SQLite).
  > `railway.toml` runs `npx prisma db push` on every deploy — schema stays in sync automatically.
4. Railway auto-deploys on every `git push` to the connected branch.

---

### 4. Clerk (optional)

- Create an app at [clerk.com](https://clerk.com) (free tier)
- Copy **Publishable key** (`pk_live_...`) and **Secret key** (`sk_live_...`)
- Set both in the Next.js service env vars
- If omitted, Drygate runs in **demo-user mode** (no authentication, anyone can verify)

---

## Environment variables reference

See `.env.production.example` in the repo root for a template.


| Variable                                  | Required | Description                                                                         |
| ----------------------------------------- | -------- | ----------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`                     | Yes      | Full URL of the deployed app (used for server-side fetch on report page)            |
| `DATABASE_URL`                            | Yes      | Prisma connection string (Supabase postgresql URI in prod; `file:./dev.db` locally) |
| `SANDBOX_N8N_URL`                         | Yes      | Internal URL of the n8n service                                                     |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`       | Optional | Enables Clerk auth                                                                  |
| `CLERK_SECRET_KEY`                        | Optional | Required when Clerk is enabled                                                      |
| `DRYGATE_INPUT_FUZZ`                      | Optional | `true` to enable trigger fuzz variants                                              |
| `DRYGATE_EGRESS_ALLOWLIST`                | Optional | Comma-separated approved outbound hostnames                                         |
| `DRYGATE_PRODUCTION_CREDENTIAL_ALLOWLIST` | Optional | Comma-separated allowed credential names                                            |


---

## Local development

```bash
# 1. Install
npm install

# 2. Copy and edit env
cp .env.local .env.local   # already present — set DATABASE_PROVIDER=sqlite

# 3. Push schema
npm run db:push

# 4. Start sandbox n8n (pinned 0.236.2)
docker compose up -d

# 5. Start app
npm run dev
```

---

## Cost estimate


| Service                    | Monthly cost                                   |
| -------------------------- | ---------------------------------------------- |
| Supabase free tier         | $0                                             |
| Railway n8n service (idle) | ~$2–3                                          |
| Railway Next.js service    | ~$1–2                                          |
| **Total**                  | **~$3–5** (covered by Railway Hobby $5 credit) |


