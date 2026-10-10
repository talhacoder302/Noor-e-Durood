# Noor-e-Durood (نورِ درود)

A simple web app where people send Durood Shareef upon the Holy Prophet Muhammad ﷺ and add their count. Everyone sees one live, shared total. No login, no names, no leaderboard: only the shared totals are public.

Built with Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, MongoDB Atlas (Mongoose), Zod and next-intl (Urdu by default, plus English).

## Requirements

- Node.js 22.12 or newer (developed on Node 24)
- npm
- A MongoDB Atlas cluster (the free tier is enough)

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local env file and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   | Variable               | What to put there                                                 |
   | ---------------------- | ----------------------------------------------------------------- |
   | `MONGODB_URI`          | Atlas connection string (`mongodb+srv://...`)                     |
   | `MONGODB_DB`           | Database name, `noor_e_durood` by default                         |
   | `IP_HASH_SALT`         | Long random string (at least 16 characters) used to hash IPs     |
   | `ADMIN_PASSWORD`       | Password for the admin panel (at least 8 characters)             |
   | `NEXT_PUBLIC_SITE_URL` | Public site URL, e.g. `http://localhost:3000` in development      |

   A quick way to make a random salt:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```

   In Atlas, make sure your IP (or `0.0.0.0/0` for the host) is on the Network Access list.

3. Create the collections, the Settings document and the counters (safe to run again; it never touches existing counts):

   ```bash
   npm run db:seed
   ```

   To wipe everything and start every counter from 0 (deletes all entries):

   ```bash
   npm run db:seed -- --reset
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   - Urdu: http://localhost:3000
   - English: http://localhost:3000/en
   - My count (private): http://localhost:3000/mera-hisaab
   - Database check: http://localhost:3000/api/health should return `{"ok":true,"db":"up"}`

## Scripts

| Command             | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Development server                           |
| `npm run build`     | Production build, then builds the service worker (`public/sw.js`) |
| `npm start`         | Run the production build                     |
| `npm run lint`      | ESLint                                       |
| `npm run typecheck` | TypeScript check for the app and the service worker |
| `npm test`          | Unit tests (Vitest, with an in-memory MongoDB) |
| `npm run db:seed`   | Create collections, Settings and counters    |

## API

| Route | What it does |
| --- | --- |
| `GET /api/stats` | `{ total, today, month, dayKey }`, cached on the server for about 3 seconds |
| `POST /api/durood` | Body `{ deviceId, count, mode, clientId }`. Adds a count and returns the new totals. A retry with the same `clientId` is never counted twice. |
| `POST /api/device` | Links the browser's anonymous device id with its httpOnly cookie |
| `GET /api/me?deviceId=` | This device's own today / week / month / all time and last 7 days (private, never cached) |
| `POST /api/recovery` | Makes (or replaces) this device's recovery code; only a hash is stored |
| `POST /api/recovery/restore` | Body `{ deviceId, code }`. Links this phone to the code's count |
| `GET /api/health` | Database check |

Limits: up to 10,000 per entry and 100,000 per device per day (changeable in Settings), 30 requests per minute per device and 120 per IP.

## Installable app (PWA)

The production build adds a service worker (Serwist). The site can be installed from the browser, and the tasbeeh keeps counting offline: taps are saved on the phone and sent once the connection is back. The service worker only runs in production builds (`npm run build && npm start`), not in `npm run dev`.

## Tests

`npm test` runs the unit tests. The counter service tests start a throwaway MongoDB with mongodb-memory-server; the first run downloads a MongoDB binary (several hundred MB) into `node_modules/.cache`.

## Project layout

```
src/
  app/              pages (under [locale]) and route handlers (api/)
  server/           services; the only place that talks to the database
  models/           Mongoose models
  lib/              db connection, env validation, formatting, dates
  components/
    ui/             shadcn/ui components
    shared/         header, footer, theme and language switches
    counter/        counter, tasbeeh tabs and number entry
    tasbeeh/        tap button, offline queue glue
    me/             personal count page
    pwa/            install card, service worker registration
  sw/               service worker source
  assets/og/        fonts and pre-rendered Urdu text for the share image
  i18n/             routing, request config and Urdu/English messages
scripts/            one-off Node scripts (database setup)
```

## Deploying (Hostinger Node.js)

1. Set the same environment variables in the hosting panel. `NEXT_PUBLIC_SITE_URL` must be the real https address (used for share links, the sitemap and preview images) and is read at build time.
2. Build with `npm run build` and start with `npm start`.
3. Allow the host's outbound IP in Atlas Network Access.
4. Serve over https; browsers only install the app and run the service worker on https.
