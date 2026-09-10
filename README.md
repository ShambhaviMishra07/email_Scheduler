# ReachInbox Email Scheduler — Submission

**Live demo:** https://your-frontend.vercel.app
**Backend API:** https://your-backend.onrender.com
**Bull Board (live queue dashboard):** https://your-backend.onrender.com/admin/queues

## How to run the backend (Express, Redis, DB, BullMQ worker)

### 1. Start infra
```bash
docker compose up -d postgres redis
```
Confirm both are running: `docker compose ps`

### 2. Configure environment
```bash
cd backend
cp .env.example .env
```
Fill in `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (see Google OAuth setup below) and, optionally, `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`.

### 3. Install, migrate, run
```bash
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```
This single command starts **both** the Express API and the BullMQ worker in one process (the worker is imported directly into `index.ts`), so no second terminal is needed. If you want to run the worker as a fully separate process (closer to a real production split), use `npm run worker` instead alongside `npm run dev`.

### 4. Verify
- `curl http://localhost:4000/health` → `{"ok":true}`
- `http://localhost:4000/admin/queues` → Bull Board dashboard loads
- Terminal should log `Email worker started (concurrency=5, ...)` on boot

## How to run the frontend
```bash
cd frontend
npm install
npm run dev
```
Visit `http://localhost:3000` — redirects to `/login`.

## Setting up Ethereal Email
No manual setup needed. The first time a user logs in, a `Sender` row is auto-created via `POST /api/senders`, which calls `nodemailer.createTestAccount()` to provision a fresh Ethereal inbox on the fly. Its SMTP host/port/credentials are stored on that `Sender` row and used automatically for every send — nothing to configure by hand.

## Setting up Google OAuth
1. [console.cloud.google.com](https://console.cloud.google.com) → new project → **APIs & Services → OAuth consent screen** → User type: External → fill basic info → add your own email under **Test users** (required while the app is in Testing mode).
2. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - **Application type: Web application** (critical — other types get rejected with a policy error).
   - Authorized redirect URI: `http://localhost:4000/api/auth/google/callback` (add your production callback URL here too once deployed).
3. Copy Client ID/Secret into `backend/.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

## Setting up Slack (optional — rate-limit notifications)
1. [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From scratch.
2. **OAuth & Permissions** → add redirect URL `http://localhost:4000/api/slack/callback`.
3. **Incoming Webhooks** → toggle Activate.
4. **Basic Information** → copy Client ID/Secret into `.env` as `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`.

## Environment variables
See `backend/.env.example` for the full list, including:
- `WORKER_CONCURRENCY`, `DEFAULT_MIN_DELAY_MS`, `DEFAULT_MAX_EMAILS_PER_HOUR` — configurable via env, overridable per-sender.
- `FRONTEND_URL` — must exactly match your frontend's origin (used for CORS + OAuth redirects).

## Architecture

### How scheduling works (no cron)
`POST /api/schedule` writes one `EmailBatch` row plus one `EmailJob` row per recipient into Postgres, then adds a **BullMQ delayed job** per row (`delay = scheduledFor - now`). Postgres is the source of truth; BullMQ/Redis is just the timer. Nothing polls or cron-schedules — BullMQ's delayed-job mechanism (a Redis sorted set) fires each job at the right time, and the worker (imported directly into the API process) processes it.

### How persistence on restart is handled
1. Redis persistence is on (`--appendonly yes`), so delayed jobs survive a Redis restart on their own.
2. `recoverPendingJobs()` runs once at process boot: walks every `EmailJob` still `SCHEDULED`/`RESCHEDULED` and re-enqueues any missing from the BullMQ queue (with `delay = 0` if the time already passed, so nothing due is silently lost).
3. `reclaimStuckProcessingJobs()` also runs at boot, catching rows stuck at `PROCESSING` because the process died mid-send — reset to `SCHEDULED` and re-enqueued with a fresh job id.
4. Idempotency: each job's `jobId` is deterministic (`email:<EmailJob.id>:v<version>`), so BullMQ refuses duplicate jobs, and the worker also checks `EmailJob.status` before sending (skips if already `SENT`) — together these guarantee restarts never duplicate or lose a send.

### How rate limiting & concurrency are implemented
- **Concurrency**: `WORKER_CONCURRENCY` controls how many BullMQ jobs run in parallel.
- **Min delay between sends**: `Sender.minDelayMs`, awaited before each SMTP call, throttling one sender's throughput even under high concurrency.
- **Emails per hour**: enforced per-sender via an atomic Redis Lua script (`INCR` + limit check in one round trip), keyed by `ratelimit:<senderId>:<UTC hour>` — safe across multiple worker instances since it's not an in-memory counter.
- **On limit hit**: the job is not dropped — it's rescheduled to the next UTC hour boundary and re-enqueued with a new job id (version bump avoids `jobId` collision with the completing old job). Only the first job to hit the limit in a window pings Slack (Redis `SET NX` dedup), so a large batch doesn't spam notifications.
- **Trade-off**: fixed-hour windows (not sliding-window/token-bucket) were chosen for simplicity; a burst can briefly exceed the true hourly rate right at a window boundary.

## Features implemented

**Backend**
- [x] Scheduler: BullMQ delayed jobs, no cron
- [x] Persistence: restart recovery + stuck-job reclaim
- [x] Rate limiting: per-sender hourly cap (atomic Redis), reschedule-not-drop
- [x] Concurrency: configurable worker concurrency + per-sender min delay
- [x] Idempotency: deterministic job IDs + status-guarded sends
- [x] Slack OAuth + live notification on rate-limit hit (deduped)
- [x] Live Bull Board dashboard
- [x] Google OAuth login
- [ ] Elasticsearch search — hooks implemented, safe no-op if ES isn't running; not deployed for this submission

**Frontend**
- [x] Google login screen
- [x] Dashboard: header (name/email/avatar), Scheduled/Sent tabs, Compose button
- [x] Compose: subject, body, CSV/text upload with detected-count, delay + hourly limit fields, Send Later picker
- [x] Scheduled/Sent lists with status badges, loading + empty states
- [x] Click-to-preview email detail (including live Ethereal preview link)

## Assumptions / shortcuts
- One `Sender` = one auto-provisioned Ethereal account; real SMTP is a drop-in credential swap.
- Fixed-hour-window rate limiting instead of sliding window.
- Email/password fields on login are visual-parity-only (disabled) — only Google OAuth is wired per spec.
- Rich-text formatting toolbar from the Figma is not wired; body is sent as a plain HTML string.
- Worker runs in-process with the API (not a separate service) due to Render free-tier not offering standalone Background Workers.
- Free-tier Render services spin down after inactivity; first request after idle can take 30–60s and may briefly show a timeout/500 — retrying immediately succeeds.