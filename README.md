# Noor-e-Durood (نورِ درود)

A simple web app where people send Durood Shareef upon the Holy Prophet Muhammad ﷺ and add their count. Everyone sees one live, shared total. No login needed.

Urdu by default (right-to-left), with English at `/en`. Built for phones and slow mobile internet, and it keeps counting offline.

<!-- Screenshots: add images to docs/screenshots/ with these names -->

| Home | Tasbeeh | My count | Admin |
| --- | --- | --- | --- |
| ![Home page](docs/screenshots/home.png) | ![Tasbeeh](docs/screenshots/tasbeeh.png) | ![My count](docs/screenshots/my-count.png) | ![Admin dashboard](docs/screenshots/admin.png) |

## Features

**For everyone**
- Live shared counter (total, today, this month) that updates every few seconds with a count-up animation. Numbers in lakh/crore style in Urdu (1,23,45,678 · "1 کروڑ 23 لاکھ") and international style in English.
- **Tasbeeh mode**: a big round tap button, vibration on each tap, gentle messages at 33, 100, 313 and every 1,000, optional click sound, and a full-screen focus mode that keeps the screen awake.
- **Number mode**: type how many you recited (Urdu digits work too) with quick +11 / +33 / +100 / +313 / +1000 buttons.
- Taps are saved on the phone and sent in batches; nothing is lost offline or on a bad connection, and nothing is ever counted twice.
- Durood Ibrahimi and the short durood in Arabic with Urdu (or English) translation.
- **میرا حساب (My count)**: your own today / week / month / all-time count and a 7-day chart. An optional recovery code links a second phone. No login.
- Share on WhatsApp or the phone's share sheet; a live preview image shows the total.
- Friday reminder banner, announcements and a gentle "paused" notice from the admin.
- Installable app (PWA) with an offline page where the tasbeeh still works.
- Light and dark mode.

**For the admin** (`/admin`, one password)
- Dashboard: total, today, month, active devices today, entries per hour today, last 30 days, and the largest recent entries (device id shortened, never an IP).
- Entries list with filters (size, device, time). Remove an entry with a reason: its count is taken back off every total. Block a device from submitting.
- Settings: limits per entry and per device per day, announcement, Friday text (Urdu and English), pause submissions.
- "Recalculate totals" rebuilds every counter from the entries (a safety tool).

## Tech

Next.js 16 (App Router, Cache Components) · TypeScript · Tailwind CSS v4 · shadcn/ui · Framer Motion · MongoDB Atlas with Mongoose · Zod · next-intl · Serwist (service worker) · Vitest.

## Requirements

- Node.js 22.12 or newer (developed on Node 24)
- npm
- A MongoDB Atlas cluster (the free tier is enough)

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create your local env file and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   | Variable               | What to put there |
   | ---------------------- | ----------------- |
   | `MONGODB_URI`          | Atlas connection string (`mongodb+srv://...`) |
   | `MONGODB_DB`           | Database name, `noor_e_durood` by default |
   | `IP_HASH_SALT`         | Long random string (at least 16 characters) used to hash IPs and recovery codes |
   | `ADMIN_PASSWORD`       | Admin password: a bcrypt hash from `npm run admin:hash` (recommended) or plain text (8+ characters) |
   | `NEXT_PUBLIC_SITE_URL` | Public site URL, e.g. `http://localhost:3000` in development |

   ```bash
   # random salt
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   # bcrypt hash of an admin password (use the \$-escaped line in .env.local)
   npm run admin:hash -- "your long admin password"
   ```

   In Atlas, make sure your IP is on the Network Access list.

3. Create the collections, the Settings document and the counters (safe to run again; it never touches existing counts):

   ```bash
   npm run db:seed
   ```

   `npm run db:seed -- --reset` wipes all counts and entries and starts from 0.

4. Start the dev server:

   ```bash
   npm run dev
   ```

   - Urdu: http://localhost:3000 · English: http://localhost:3000/en
   - My count: http://localhost:3000/mera-hisaab
   - Admin: http://localhost:3000/admin
   - Database check: http://localhost:3000/api/health returns `{"ok":true,"db":"up"}`

   The service worker, install prompt and offline mode only run in a production build: `npm run build && npm start`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build, then builds the service worker (`public/sw.js`) |
| `npm start` | Runs the production build (uses `PORT` if set, otherwise 3000) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check for the app and the service worker |
| `npm test` | Unit tests (Vitest, with an in-memory MongoDB) |
| `npm run db:seed` | Create collections, Settings and counters |
| `npm run admin:hash -- "password"` | Print a bcrypt hash for `ADMIN_PASSWORD` |

## API

| Route | What it does |
| --- | --- |
| `GET /api/stats` | `{ total, today, month, dayKey }`, cached on the server for about 3 seconds |
| `POST /api/durood` | Body `{ deviceId, count, mode, clientId }`. Adds a count and returns the new totals. A retry with the same `clientId` is never counted twice. |
| `POST /api/device` | Links the browser's anonymous device id with its httpOnly cookie |
| `GET /api/me?deviceId=` | This device's own counts and last 7 days (private, never cached) |
| `POST /api/recovery` | Makes (or replaces) this device's recovery code; only a hash is stored |
| `POST /api/recovery/restore` | Body `{ deviceId, code }`. Links this phone to the code's count |
| `GET /api/health` | Database check |

Admin actions are Server Actions, each checking the admin session first.

## Privacy and security

- No accounts. Each phone gets an anonymous random id (localStorage + httpOnly cookie).
- IPs are never stored, only a salted SHA-256 hash used for rate limits. Device ids are never shown publicly.
- Every input is validated with Zod. Totals only change with atomic `$inc`; each submission has a unique id, so retries can't double count.
- Rate limits: 30 submissions per minute per device and 120 per IP; 5 admin logins per 15 minutes per IP; recovery-code guesses are limited too.
- Admin: bcrypt-checked password, signed httpOnly `SameSite=Strict` session cookie (12 hours).
- Security headers: Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.

## Tests

`npm test` runs the unit tests: number formatting, Karachi dates, the offline tap queue, the counter service (atomic increments, idempotency, limits), personal counts and recovery codes, and the admin tools. The service tests start a throwaway MongoDB with mongodb-memory-server; the first run downloads a MongoDB binary (several hundred MB) into `node_modules/.cache`.

## Project layout

```
src/
  app/              pages (under [locale]), admin, route handlers (api/), metadata files
  server/           services; the only place that talks to the database
  models/           Mongoose models
  lib/              db connection, env validation, formatting, dates, queue logic
  components/
    ui/             shadcn/ui components
    shared/         header, footer, notices, sharing, durood card
    counter/        live counter, tabs, number entry
    tasbeeh/        tap button, focus mode, offline queue glue
    me/             personal count page
    admin/          admin panel
    pwa/            install card, service worker registration
  sw/               service worker source
  assets/og/        fonts and pre-rendered Urdu text for the share image
  i18n/             routing, request config and Urdu/English messages
scripts/            seed, service worker build, admin password hash
```

## Deploying

See **[DEPLOY.md](DEPLOY.md)** for step-by-step Hostinger (hPanel) instructions: GitHub import, Node version, build settings, environment variables, MongoDB Atlas network access, domain and SSL, and seeding.
