# Local development setup

Step-by-step guide to clone **Resumesensei** (AI Resume Builder) and run the full stack on your machine: PostgreSQL, API server, and React frontend.

---

## What you are running

| Service | Folder | Default URL |
|---------|--------|-------------|
| **Frontend** (Vite + React) | `artifacts/resume-maker` | http://localhost:5173 |
| **API** (Express) | `artifacts/api-server` | http://localhost:8080 |
| **Database** (PostgreSQL) | Docker container | `localhost:5433` |

The frontend proxies `/api` to the backend in development, so you usually do **not** need `VITE_API_URL` locally.

---

## Prerequisites

Install these before you start:

1. **[Node.js](https://nodejs.org/)** v20 or newer  
2. **[pnpm](https://pnpm.io/installation)** v9+ (this repo enforces pnpm; npm/yarn will fail on install)  
3. **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** (recommended for local PostgreSQL)  
4. **Git**

Optional accounts (for full feature testing):

| Service | Used for |
|---------|----------|
| [Clerk](https://clerk.com) | Sign-in / sign-up (required) |
| [OpenAI](https://platform.openai.com) | AI summary, bullets, skills (required for API to start) |
| [Razorpay](https://razorpay.com) test mode | Pro checkout (optional locally — mocks exist) |
| [Resend](https://resend.com) | Contact form email (optional locally) |

You can use [Neon](https://neon.tech) instead of Docker for Postgres if you prefer a hosted database (see [Alternative: Neon database](#alternative-neon-database)).

---

## First-time setup

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd ai-resume-builder
```

Use your actual Git URL (GitHub, etc.). The folder name may differ; `cd` into the repo root where `pnpm-workspace.yaml` lives.

### 2. Install dependencies

From the **repository root**:

```bash
pnpm install
```

This installs all workspace packages (`artifacts/*`, `lib/*`).

### 3. Start PostgreSQL (Docker)

Port **5433** is used so this does not conflict with another Postgres on `5432`.

**macOS / Linux:**

```bash
docker run -d --name resumeai-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=resumeai \
  -p 5433:5432 \
  postgres:16
```

**Windows (PowerShell):**

```powershell
docker run -d --name resumeai-postgres `
  -e POSTGRES_USER=postgres `
  -e POSTGRES_PASSWORD=secret `
  -e POSTGRES_DB=resumeai `
  -p 5433:5432 `
  postgres:16
```

If the container already exists from a previous attempt:

```bash
docker start resumeai-postgres
```

### 4. Configure environment variables

#### Backend — `artifacts/api-server/.env`

Create this file (it is gitignored). Minimum for local development:

```env
# Server
PORT=8080
NODE_ENV=development

# Database (must match Docker credentials above)
DATABASE_URL=postgresql://postgres:secret@localhost:5433/resumeai

# Clerk — Dashboard → API Keys (use Development instance)
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# OpenAI — required; API imports OpenAI client at startup
AI_INTEGRATIONS_OPENAI_API_KEY=sk-...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1

# Razorpay (optional locally — defaults to mock values if omitted)
# RAZORPAY_KEY_ID=rzp_test_...
# RAZORPAY_KEY_SECRET=...
# RAZORPAY_WEBHOOK_SECRET=...
# RAZORPAY_MONTHLY_PLAN_ID=...
# RAZORPAY_YEARLY_PLAN_ID=...

# Contact form (optional locally — without these, contact returns 503)
# RESEND_API_KEY=re_...
# CONTACT_FROM_EMAIL=Resumesensei <hello@yourdomain.com>
# CONTACT_TO_EMAIL=support@resumesensei.com
```

#### Frontend — `artifacts/resume-maker/.env`

```env
# Clerk — same Development publishable key as backend
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Razorpay public key (optional — mock key used if omitted)
# VITE_RAZORPAY_KEY_ID=rzp_test_...

# Usually not needed locally — Vite proxies /api → http://localhost:8080
# VITE_API_URL=http://localhost:8080/api
```

#### Clerk dashboard (one-time)

In [Clerk Dashboard](https://dashboard.clerk.com) → your application → **Configure**:

- Add **http://localhost:5173** under allowed origins / redirect URLs for local sign-in.

### 5. Apply the database schema

`DATABASE_URL` must be available when Drizzle runs. From the **repository root**:

**macOS / Linux:**

```bash
DATABASE_URL=postgresql://postgres:secret@localhost:5433/resumeai pnpm run db:push
```

**Windows (PowerShell):**

```powershell
$env:DATABASE_URL="postgresql://postgres:secret@localhost:5433/resumeai"
pnpm run db:push
```

You should see Drizzle apply tables without errors. Re-run this after pulling schema changes from `main`.

### 6. Start the app

From the **repository root**:

```bash
pnpm run dev
```

This starts **both** services:

- **API** — builds then listens on **http://localhost:8080** (`pnpm run dev:api`)
- **Web** — Vite on **http://localhost:5173** (`pnpm run dev:web`)

Open **http://localhost:5173** in your browser, sign in, and use the builder.

---

## Daily / later runs

After the first-time setup you only need:

1. **Docker Desktop** running (if you use local Postgres).
2. Start the database container (if it is stopped):

   ```bash
   docker start resumeai-postgres
   ```

3. From the repo root:

   ```bash
   pnpm run dev
   ```

4. Open **http://localhost:5173**.

You do **not** need to run `pnpm install` or `db:push` every day unless dependencies or schema changed.

### After `git pull`

```bash
pnpm install
# If lib/db schema changed:
DATABASE_URL=postgresql://postgres:secret@localhost:5433/resumeai pnpm run db:push
pnpm run dev
```

---

## Running services separately

Useful when debugging one side only.

| Command | What it does |
|---------|----------------|
| `pnpm run dev` | API + frontend together |
| `pnpm run dev:api` | API only (port **8080**) |
| `pnpm run dev:web` | Frontend only (port **5173**) |

The API `dev` script **builds** then **starts** (`artifacts/api-server`). After changing backend TypeScript, restart `dev:api` so it rebuilds.

Production build check:

```bash
pnpm run build
```

---

## Alternative: Neon database

Skip Docker and use a free [Neon](https://neon.tech) Postgres URL:

1. Create a project and copy `DATABASE_URL`.
2. Put it in `artifacts/api-server/.env` as `DATABASE_URL`.
3. Run `pnpm run db:push` with that URL set in the shell (same as step 5 above).

---

## Environment variable reference

### Backend (`artifacts/api-server/.env`)

| Variable | Required locally? | Purpose |
|----------|-------------------|---------|
| `PORT` | **Yes** | API port (use `8080`) |
| `DATABASE_URL` | **Yes** | PostgreSQL connection string |
| `CLERK_SECRET_KEY` | **Yes** | Clerk backend auth |
| `CLERK_PUBLISHABLE_KEY` | **Yes** | Clerk (also used by Express middleware) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | **Yes** | OpenAI API key |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | **Yes** | Usually `https://api.openai.com/v1` |
| `RAZORPAY_*` | No | Payment; mocks if unset |
| `RESEND_API_KEY` | No | Contact form sending |
| `CONTACT_FROM_EMAIL` | No | Verified sender for Resend |
| `CONTACT_TO_EMAIL` | No | Inbox for contact submissions |

### Frontend (`artifacts/resume-maker/.env`)

| Variable | Required locally? | Purpose |
|----------|-------------------|---------|
| `VITE_CLERK_PUBLISHABLE_KEY` | **Yes** | Clerk UI |
| `VITE_RAZORPAY_KEY_ID` | No | Checkout UI |
| `VITE_API_URL` | No | Defaults to Vite proxy `/api` → `localhost:8080` |

---

## Troubleshooting

### `Use pnpm instead` on install

This monorepo requires pnpm:

```bash
npm install -g pnpm
pnpm install
```

### `PORT environment variable is required`

Create `artifacts/api-server/.env` with `PORT=8080`.

### `AI_INTEGRATIONS_OPENAI_* must be set`

Add OpenAI keys to `artifacts/api-server/.env` (see step 4).

### `password authentication failed for user "postgres"`

`DATABASE_URL` must match the Docker user, password, port **5433**, and database name `resumeai`.

### `EADDRINUSE` on port 8080 or 5173

Another process is using that port. Stop it or change `PORT` in the relevant `.env`.

### Templates load but creating a resume fails

Database is unreachable or schema was not applied. Confirm Docker is running and re-run `pnpm run db:push`.

### Sign-in fails on localhost

Add **http://localhost:5173** in the Clerk Dashboard for your development application.

### API requests fail from the browser

1. Confirm `pnpm run dev:api` is running and logs `Server listening` on port 8080.  
2. Confirm the frontend was started with `pnpm run dev:web` (or `pnpm run dev`) so the Vite `/api` proxy is active.  
3. Do not point `VITE_API_URL` at production unless intentional.

### Contact form returns an error locally

Set `RESEND_API_KEY` and `CONTACT_FROM_EMAIL` on the API, or ignore — the rest of the app works without it.

---

## Reset local database

To wipe all local data and start fresh:

```bash
docker rm -f resumeai-postgres
```

Recreate the container (same `docker run` command as step 3), then:

```bash
DATABASE_URL=postgresql://postgres:secret@localhost:5433/resumeai pnpm run db:push
```

Restart `pnpm run dev`.

---

## Project layout (quick reference)

```
ai-resume-builder/
├── artifacts/
│   ├── api-server/       # Express API — .env here
│   └── resume-maker/     # Vite React app — .env here
├── lib/
│   └── db/               # Drizzle schema & migrations
├── package.json          # Root scripts: dev, db:push, build
├── pnpm-workspace.yaml
└── localsetup.md         # This file
```

For production deployment, see `productiondeployment.md` and `freedeployment.md`.
