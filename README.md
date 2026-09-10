# WhatsApp Marketing & Automation Platform

A Zoho-style WhatsApp marketing dashboard built on the official Meta WhatsApp Cloud API (Next.js, Postgres/Drizzle, Redis/BullMQ).

## Status: Phase 8 — Analytics & Settings (all 8 planned phases complete)

Done:
- Project scaffold, Postgres/Drizzle schema, email/password auth, dashboard shell (Phase 1)
- Meta WABA connection flow — validated live against the Graph API, token encrypted at rest, webhook verify handshake (Phase 2)
- Contact management — manual add, CSV import, lists, tags, opt-out (Phase 3)
- Template sync from Meta + new-template submission with `{{n}}` variable preview (Phase 4)
- Campaigns — pick an approved template + list, map `{{1}}`/`{{2}}`… to a contact field or fixed text, optional scheduling, and a BullMQ worker that sends through the real Graph API with rate limiting, retries/backoff, and per-recipient status tracking (Phase 5)
- Webhooks — full delivery/read/failed status ingestion and inbound-reply handling from Meta, with HMAC signature verification, updating campaign recipient status, campaign rollup counts, and contact `lastInboundAt` in real time; every event is also logged to `message_events` (Phase 6)
- Automations — basic rule engine (`lib/automations/engine.ts`) firing an approved template on `contact_created` (manual add or CSV import), `keyword_reply` (inbound message contains a configured keyword, matched per WABA), or `opt_in` (a contact's opt-out is reversed); each run is logged to `automation_runs` with success/failure and Meta's actual error message; automations can be paused without deleting them (Phase 7)
- **Analytics & Settings** — overall delivery/read/reply-rate stat tiles, a 14-day sent-volume chart, and per-template performance breakdown, all computed from the campaigns/campaign_recipients rollups; Settings gets workspace rename and password change (Phase 8)

This closes out the original 8-phase build. Natural next steps beyond it: multi-user teams (invite flow, roles beyond `owner`), richer automation triggers (delays, multi-step sequences), template media headers (image/video/document), and a queue dashboard for the BullMQ worker.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL, REDIS_URL at minimum
npx drizzle-kit push         # create tables from database/schema.ts
npm run dev                  # web app
npm run worker                # campaign send worker (separate process, needs Redis)
```

Requires a running Postgres instance and a running Redis instance (the worker won't start without `REDIS_URL`).

## Stack

- Next.js 16 (App Router, route handlers, server components)
- Drizzle ORM + postgres.js
- BullMQ + ioredis — queue-based campaign sending, rate limited and retried
- jose (JWT sessions) + bcryptjs (password hashing)
- Tailwind CSS + lucide-react icons

## Project layout

```
app/(auth)/             login, signup
app/(dashboard)/        the 8 dashboard sections, behind session auth
app/api/auth/           signup, login, logout
app/api/whatsapp/       WABA connect, list, disconnect
app/api/webhooks/       Meta webhook verification handshake
app/api/contacts/       CRUD + CSV import
app/api/lists/          contact list CRUD
app/api/templates/      list, create (submit to Meta), sync (pull from Meta)
app/api/campaigns/      create, list, detail, send
database/schema.ts       Drizzle schema (source of truth for the DB)
database/relations.ts    Drizzle relations for db.query.*
lib/auth/                session + password helpers
lib/db/                  Drizzle client
lib/whatsapp/            Meta Graph API client, template + variable utilities
lib/queue/                BullMQ queue, Redis connection, recipient send processor
lib/crypto.ts             AES-256-GCM encryption for stored access tokens
lib/csv.ts                CSV parser for contact import
workers/campaign-worker.ts  standalone process that drains the campaign send queue
components/dashboard/    sidebar, page header, per-section manager components
```

## Campaign sending model

1. Creating a campaign (`POST /api/campaigns`) stores it as `draft` — no messages sent yet.
2. Launching it (`POST /api/campaigns/:id/send`) snapshots the list's non-opted-out members into `campaign_recipients` (status `pending`), then enqueues one BullMQ job per recipient (`jobId = recipientId`, so re-sends are idempotent). A future `scheduledAt` becomes a per-job delay; the campaign status goes `scheduled` → `sending` once the worker picks up the first job, then `completed` once every recipient reaches a terminal status.
3. `workers/campaign-worker.ts` drains the queue with a configurable concurrency and a queue-wide rate limit (`RATE_LIMIT_PER_SECOND`, `WORKER_CONCURRENCY`) to stay under Meta's per-number messaging tier. Each job resolves that recipient's `{{n}}` values, calls the Graph API, and updates `campaign_recipients` + the campaign's rollup counters. Failures retry up to 3 times with exponential backoff before being recorded as `failed` with Meta's actual error message.
