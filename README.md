# FlowMaster AI — Cashflow Intelligence Backend

A production-ready financial intelligence engine that analyzes merchant cashflow across Shopify and TikTok Shop, detects liquidity risk, and recommends early payouts before a merchant's balance goes negative.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Framework | Hono |
| Language | TypeScript (ESM) |
| Database | PostgreSQL via Neon |
| ORM | Drizzle ORM |
| Auth | JWT (jose) + bcryptjs |
| Validation | Zod |
| Scheduler | node-cron |
| Runtime | Node.js 20+ |

---

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — minimum required:

```env
DATABASE_URL=postgresql://...@ep-xxx.neon.tech/flowmaster?sslmode=require

# Generate these — do not share or commit:
JWT_ACCESS_SECRET=<node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
JWT_REFRESH_SECRET=<same command, different value>
ENCRYPTION_KEY=<node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
```

### 3. Run migrations

```bash
npm run db:generate   # generate SQL from schema
npm run db:migrate    # apply to Neon DB
```

### 4. Seed demo data

```bash
npm run seed
```

This creates one merchant account and 30 days of financial event history:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Merchant ID  : <uuid from DB>
  Email        : admin@flowmaster.ai
  Password     : FlowMaster2024!
  Company      : Acme Commerce LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 5. Start dev server

```bash
npm run dev
# → http://localhost:3000
```

---

## Authentication

### How it works

1. Merchant registers or logs in via `/api/auth/register` or `/api/auth/login`
2. Server returns an **access token** (JWT, 15min) and a **refresh token** (opaque, 30 days)
3. Every protected API request includes: `Authorization: Bearer <accessToken>`
4. The `requireAuth` middleware decodes the JWT and injects `merchantId` into the request context
5. All route handlers call `getMerchantId(c)` — no more `?merchantId=` query params
6. When the access token expires, call `/api/auth/refresh` with the refresh token to get a new pair
7. Refresh tokens rotate on every use — the old one is revoked immediately

### Token storage (frontend)

Store the refresh token in an `httpOnly` cookie or secure storage. Store the access token in memory (not localStorage — XSS risk).

---

## API Reference

### Auth

All auth endpoints are public (no token required except `/me`).

#### Register
```
POST /api/auth/register
Content-Type: application/json

{
  "email": "you@example.com",
  "password": "min8chars",
  "companyName": "Your Company",
  "fullName": "Your Name"
}
```

Response `201`:
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "abc123...",
  "expiresIn": 900,
  "merchant": { "id": "uuid", "email": "...", "companyName": "..." }
}
```

#### Login
```
POST /api/auth/login
{ "email": "...", "password": "..." }
```
Same response shape as register.

#### Refresh
```
POST /api/auth/refresh
{ "refreshToken": "abc123..." }
```
Returns a new token pair. Old refresh token is immediately revoked.

#### Logout
```
POST /api/auth/logout
{ "refreshToken": "abc123..." }
```
Revokes the refresh token. Client should discard the access token.

#### Me
```
GET /api/auth/me
Authorization: Bearer <accessToken>
```

---

### Dashboard

```
GET /api/dashboard/summary
Authorization: Bearer <accessToken>
```

`merchantId` is read from the JWT — no query param needed.

Response:
```json
{
  "availableToday": 16100.00,
  "inTransit": 7500.00,
  "forecast14d": 18480.00,
  "avgDailyInflow": 1320.00,
  "avgDailyExpenses": 533.00,
  "riskLevel": "low",
  "cashCoverageDays": 30.2,
  "warnings": ["You are in a healthy cash position."],
  "recommendedLiquidity": 0
}
```

---

### Marketplace Integrations

All require `Authorization: Bearer <accessToken>`.

```
GET    /api/marketplace/platforms          # public catalog
GET    /api/marketplace/connections        # list merchant's connections
POST   /api/marketplace/connections        # add a new connection
PATCH  /api/marketplace/connections/:id    # update credentials / name
DELETE /api/marketplace/connections/:id    # remove connection
POST   /api/marketplace/connections/:id/sync  # trigger manual sync
```

---

### Liquidity

```
POST /api/liquidity/request
Authorization: Bearer <accessToken>
```

---

## Database Schema

```
merchants                    ← user accounts, passwords hashed with bcrypt
  └─ refresh_tokens          ← hashed refresh tokens with expiry + revocation
  └─ financial_events        ← normalized events from all platforms
  └─ merchant_financial_settings
  └─ risk_snapshots
  └─ liquidity_requests
  └─ marketplace_connections ← encrypted API credentials per platform
```

`merchant_id` flows from `merchants.id` as a FK into every other table. Deleting a merchant cascades to all related data.

---

## Project Structure

```
src/
  app.ts                    # Hono app, middleware, route mounting
  server.ts                 # HTTP server + cron bootstrap

  config/env.ts             # Zod-validated env (fails fast on startup)

  db/
    client.ts               # Neon + Drizzle singleton
    schema.ts               # All tables + type exports

  middleware/
    auth.ts                 # requireAuth middleware + getMerchantId helper

  modules/
    auth/
      token.utils.ts        # signAccessToken, verifyAccessToken, generateRefreshToken
      auth.service.ts       # register, login, refresh, logout, getMe
      auth.routes.ts        # POST /register /login /refresh /logout  GET /me

    cashflow/
      cashflow.service.ts   # getMerchantSummary()
      risk-engine.ts        # evaluateRisk() + calcRecommendedLiquidity()

    finance/
      financial-events.repository.ts
      financial-events.service.ts

    dashboard/
      dashboard.controller.ts
      dashboard.routes.ts

    liquidity/
      liquidity.service.ts
      liquidity.routes.ts

    integrations/
      marketplace/
        platform-registry.ts    # Shopify, TikTok, Amazon, WooCommerce, Lazada
        credentials.ts          # AES-256-GCM encrypt/decrypt
        marketplace.service.ts
        marketplace.routes.ts
      shopify/  client / mapper / sync
      tiktok/   client / mapper / sync

    scheduler/
      risk-monitor.job.ts   # daily cron — evaluates all active merchants

scripts/
  seed.ts                   # creates demo merchant + 30d of events
```

---

## Production Deployment

```bash
npm run build
NODE_ENV=production node dist/server.js
```

Key checklist:
- `DATABASE_URL` pointing to Neon production branch
- `JWT_ACCESS_SECRET` and `JWT_REFRESH_SECRET` are long random secrets (not shared between environments)
- `ENCRYPTION_KEY` is set and backed up securely
- `npm run db:migrate` run on first deploy
