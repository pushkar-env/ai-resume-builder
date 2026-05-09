# Run Locally (with PostgreSQL)

## Prerequisites
- Node.js installed
- `pnpm` installed globally
- Docker Desktop installed and running

## 1) Install dependencies
From the workspace root:

```bash
pnpm install
```

## 2) Start PostgreSQL with Docker
Run this once from any terminal:

```bash
docker run -d --name resumeai-postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=resumeai \
  -p 5433:5432 \
  postgres:16
```

If the container already exists, just start it:

```bash
docker start resumeai-postgres
```

### Why port `5433`?
Some machines already have Postgres on `5432`. Using `5433` avoids port conflicts.

## 3) Configure backend env
The backend reads local values from:
- `artifacts/api-server/.env`

Make sure it includes at least:

```env
PORT=8080
DATABASE_URL=postgresql://postgres:secret@localhost:5433/resumeai
CLERK_SECRET_KEY=...
CLERK_PUBLISHABLE_KEY=...
SESSION_SECRET=...
AI_INTEGRATIONS_OPENAI_API_KEY=...
AI_INTEGRATIONS_OPENAI_BASE_URL=https://api.openai.com/v1
```

## 4) Apply database schema
From workspace root:

```bash
DATABASE_URL=postgresql://postgres:secret@localhost:5433/resumeai pnpm --dir lib/db run push
```

PowerShell equivalent:

```powershell
$env:DATABASE_URL="postgresql://postgres:secret@localhost:5433/resumeai"
pnpm --dir lib/db run push
```

## 5) Start the Application
You can start both the backend API and the frontend client concurrently from the workspace root:

```bash
pnpm run dev
```

This will run:
- **Backend**: `http://localhost:8080`
- **Frontend**: `http://localhost:5173` (or the port you configured)

## Daily startup (after first-time setup)
1. Start Docker Desktop
2. `docker start resumeai-postgres` (if not already running)
3. `pnpm run dev`

## Common issues
- **`password authentication failed for user "postgres"`**
  - Check `DATABASE_URL` matches the Docker credentials shown above.
- **`EADDRINUSE` on port `8080`**
  - Another process is already using API port `8080`; stop it and retry.
- **Templates load but resume creation fails**
  - Usually means DB is not reachable or schema was not pushed; re-run step 4.

## How to Clear the Database (Start Fresh)
Because the database runs locally in Docker without a persistent volume binding, you can wipe it completely by simply recreating the container.

1. **Stop and remove the existing container:**
   ```powershell
   docker rm -f resumeai-postgres
   ```
2. **Re-run the setup command to create a fresh database:**
   ```powershell
   docker run -d --name resumeai-postgres -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=resumeai -p 5433:5432 postgres:16
   ```
3. **Re-apply the database schema:**
   ```powershell
   $env:DATABASE_URL="postgresql://postgres:secret@localhost:5433/resumeai"
   pnpm --dir lib/db run push
   ```
4. **Restart your dev server** (`pnpm run dev`). You can now test with a completely clean database!
