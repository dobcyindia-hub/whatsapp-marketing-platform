# WhatsApp Marketing & Automation Platform

A Zoho-style WhatsApp marketing dashboard built on the official Meta WhatsApp Cloud API (Next.js, Postgres/Drizzle, Redis/BullMQ).

## Status: Phase 1 — Foundation

Done:
- Project scaffold (Next.js App Router, TypeScript, Tailwind)
- Postgres schema (teams, users, WABA accounts, contacts, lists, templates, campaigns, recipients, automations, message events) — `database/schema.ts`
- Email/password auth with signed session cookies — `lib/auth/`
- Dashboard shell with the 8 nav sections (Overview, Contacts, Templates, Campaigns, Automations, WhatsApp, Analytics, Settings) and empty states

Not yet built (later phases): Meta OAuth connection flow, template sync, CSV contact import, campaign send worker (BullMQ), Meta webhook receiver, automation rule engine, analytics charts.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in DATABASE_URL at minimum
npx drizzle-kit push         # create tables from database/schema.ts
npm run dev
```

Requires a running Postgres instance. Redis is only needed starting Phase 5 (campaign sending).

## Stack

- Next.js 16 (App Router, route handlers, server components)
- Drizzle ORM + postgres.js
- BullMQ + ioredis (queue-based campaign sending, Phase 5+)
- jose (JWT sessions) + bcryptjs (password hashing)
- Tailwind CSS + lucide-react icons

## Project layout

```
app/(auth)/           login, signup
app/(dashboard)/      the 8 dashboard sections, behind session auth
app/api/auth/         signup, login, logout
database/schema.ts     Drizzle schema (source of truth for the DB)
database/relations.ts  Drizzle relations for db.query.*
lib/auth/              session + password helpers
lib/db/                Drizzle client
components/dashboard/  sidebar, page header, empty state
```
