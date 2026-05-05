# Backlink Exchange Backend

Node.js + Express + TypeScript API for the backlink exchange WordPress plugin.

## Quick Start with Docker

```bash
# Just run this one command - everything starts together!
docker compose up -d

# Check if running
curl http://localhost:3001/health
```

That's it! API runs at `http://localhost:3001`

## Docker Commands

```bash
# Start everything (Postgres + API)
docker compose up -d

# Stop everything
docker compose down

# View logs
docker compose logs -f api

# Rebuild after code changes
docker compose up -d --build
```

## Local Development (Without Docker)

```bash
# Install dependencies
pnpm install

# Start PostgreSQL via Docker (only DB)
docker compose up -d postgres

# Generate and run migrations
pnpm db:generate
pnpm db:migrate

# Seed initial data
pnpm db:seed

# Start dev server
pnpm dev
```

## API Endpoints

All endpoints are under `/api/v1/`

### Sites
- `POST /api/v1/sites/register` - Register a new site (returns API key)
- `GET /api/v1/sites/verify` - Verify site ownership (requires X-API-Key)
- `GET /api/v1/sites/me` - Get current site info (requires X-API-Key)
- `PATCH /api/v1/sites/me` - Update site settings (requires X-API-Key)

### Tasks
- `GET /api/v1/tasks` - List all tasks (requires X-API-Key)
- `POST /api/v1/tasks` - Create a backlink task (requires X-API-Key)
- `GET /api/v1/tasks/:id` - Get task details (requires X-API-Key)
- `PATCH /api/v1/tasks/:id` - Update task (requires X-API-Key)
- `DELETE /api/v1/tasks/:id` - Delete task (requires X-API-Key)

### Inbox (Pending Matches)
- `GET /api/v1/inbox` - Get pending link placement requests (requires X-API-Key)
- `POST /api/v1/inbox/:id/accept` - Accept a match (requires X-API-Key)
- `POST /api/v1/inbox/:id/decline` - Decline a match (requires X-API-Key)

### Placements
- `POST /api/v1/placements` - Record a placed link (requires X-API-Key)
- `GET /api/v1/placements/received` - List backlinks received (requires X-API-Key)
- `GET /api/v1/placements/given` - List backlinks given (requires X-API-Key)

### Dashboard
- `GET /api/v1/dashboard` - Get site statistics (requires X-API-Key)
- `GET /api/v1/dashboard/activity` - Get activity log (requires X-API-Key)

### Niche & Plans
- `GET /api/v1/niches` - List all niches (requires X-API-Key)
- `GET /api/v1/plans` - List all plans (requires X-API-Key)

### Indexing
- `POST /api/v1/index/pages` - Index site pages (requires X-API-Key)
- `GET /api/v1/index/stats` - Get indexing stats (requires X-API-Key)

### Matching
- `POST /api/v1/matches/run` - Trigger triangular matching (requires X-API-Key)
- `GET /api/v1/matches/stats` - Get match statistics (requires X-API-Key)

## Deploy to Cloud

### Railway
1. Go to [railway.app](https://railway.app)
2. Connect GitHub repo
3. Railway auto-detects Dockerfile + PostgreSQL
4. Add environment variable: `CORS_ORIGIN = *`
5. Deploy!

### Render
1. Go to [render.com](https://render.com)
2. Create from Dockerfile
3. Add PostgreSQL
4. Deploy!

### Docker on VPS
```bash
# On your VPS
git clone your-repo
cd backlink-pulig/backend
docker compose up -d
```

## Health Check

```
GET /health
→ { "status": "ok", "time": "..." }
```

## Authentication

All protected endpoints require the `X-API-Key` header with the API key received during site registration.

```
X-API-Key: bex_xxxxxxxxxxxxxxx
```