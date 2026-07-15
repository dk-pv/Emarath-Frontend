# Emarath Frontend

Web client for the **Emarath** ERP/CRM platform, built with [Next.js 16](https://nextjs.org/) (App Router), TypeScript, and Tailwind CSS.

This repository is intentionally **separate** from the backend (`emarath-backend`). The two apps are developed, versioned, and deployed independently.

- Frontend (this repo) → deployed to **Vercel**
- Backend → deployed to **Render**

> Scope note: this repository currently implements backlog task **FND-01.1 — Project scaffold & environments**. The landing page is a temporary scaffold to confirm the app runs; the login page, dashboard, and application shell are separate, later backlog tasks.

---

## Prerequisites

| Tool    | Version (baseline)     |
| ------- | ---------------------- |
| Node.js | v22.13.1 (Node 20+ ok) |
| npm     | 11.6.2                 |

This project uses **npm** (not pnpm/yarn).

---

## Installation

```bash
npm install
```

Development defaults are already provided in `.env.development` (non-secret,
committed), so the app runs out of the box. To customise locally, copy the
template:

```bash
cp .env.example .env.local
```

---

## Environment configuration

Only variables prefixed with **`NEXT_PUBLIC_`** are exposed to the browser, and
Next.js **inlines them at build time**. Values are therefore chosen per
environment when the app is built/deployed.

Access is centralised in [`src/lib/env.ts`](./src/lib/env.ts) (with safe
fallbacks) — components do not read `process.env` directly.

| Variable                   | Default                     | Purpose                             |
| -------------------------- | --------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_APP_NAME`     | `Emarath`                   | Display name                        |
| `NEXT_PUBLIC_APP_ENV`      | `development`               | Logical environment (see below)     |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:5000/api` | Backend API base URL (`/api` prefix)|

### Selecting an environment (no code changes)

Node's `NODE_ENV` only supports `development` / `production` / `test`, so a
dedicated **`NEXT_PUBLIC_APP_ENV`** variable distinguishes **staging** from
**production**:

| Environment   | How it is selected                                                        |
| ------------- | ------------------------------------------------------------------------- |
| `development` | `.env.development` (auto-loaded by `next dev`); override via `.env.local`  |
| `staging`     | Set `NEXT_PUBLIC_APP_ENV=staging` + URLs at build time (Vercel env vars)   |
| `production`  | Set `NEXT_PUBLIC_APP_ENV=production` + URLs at build time (Vercel env vars)|

Env file load order (first match wins): `.env.$(NODE_ENV).local` → `.env.local`
→ `.env.$(NODE_ENV)` → `.env`.

**Never commit real secrets.** Only `.env.example` and the non-secret
`.env.development` defaults are tracked; all other `.env*` files are ignored.

---

## Running locally

```bash
npm run dev
```

Open **http://localhost:3000**. The landing page shows the active environment
and pings the backend health endpoint (`NEXT_PUBLIC_API_BASE_URL` + `/health`).
If the backend is not running, the indicator degrades to "Backend offline"
without breaking the page.

---

## Quality checks

```bash
npm run lint          # ESLint (eslint-config-next + prettier compatibility)
npm run typecheck     # tsc --noEmit
npm run format        # Prettier: format src
npm run format:check  # Prettier: verify formatting (no writes)
```

---

## Build & production start

```bash
npm run build   # production build
npm run start   # serve the production build (http://localhost:3000)
```

---

## Project structure

```
src/
├── app/
│   ├── layout.tsx    # root layout + metadata
│   ├── page.tsx      # temporary Emarath landing (FND-01.1)
│   └── globals.css
├── components/
│   └── health-status.tsx  # client-side backend health indicator
└── lib/
    └── env.ts        # centralised NEXT_PUBLIC_* access
```
