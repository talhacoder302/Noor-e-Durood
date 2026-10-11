# Noor-e-Durood (نورِ درود)

A simple web app where people send Durood Shareef upon the Holy Prophet Muhammad ﷺ and add their count. Everyone sees one live, shared total. Anyone can watch; adding durood needs a simple account (mobile number + 4-digit PIN).

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
- **Accounts**: sign up with a mobile number and a 4-digit PIN, nothing else. Optional profile: name, majlis (from the admin's list or "other"), age, city. One account works on every phone; durood counted on a phone before signing up moves into the account.
- **Leaderboard**: the top 50 accounts by all-time count. Tap a name to see that person's profile: majlis, city, age, rank, today / this month / all-time and a 7-day chart.
- **میرا حساب (My count)**: your own today / week / month / all-time count and a 7-day chart, across all your phones.
- Share on WhatsApp or the phone's share sheet; a live preview image shows the total.
- Friday reminder banner, announcements and a gentle "paused" notice from the admin.
- Installable app (PWA) with an offline page where the tasbeeh still works.
- Light and dark mode.

**For the admin** (`/admin`: an admin account login plus the admin password)
- Admin accounts: mark any account as admin on the Users page. Once one exists, the panel needs that account logged in **and** the admin password (asked every 12 hours). Before the first admin account exists, the password alone opens the panel so you can mark yours. Admin accounts get an "Admin" link in the header.
- Dashboard: total, today, month, active devices today, entries per hour today, last 30 days, and the largest recent entries (device id shortened, never an IP).
- Entries list with filters (size, mobile number, time), showing who sent each one. Remove an entry with a reason: its count is taken back off every total.
- Users: search by number or name, filter by majlis, reset a forgotten PIN, disable or enable an account, make or remove admins.
- Majalis: add, edit, reorder and deactivate the list users choose from. The dashboard shows this month's totals per majlis.
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
   | `IP_HASH_SALT`         | Long random string (at least 16 characters) used to hash IPs |
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
| `npm run admin:account -- 0300… [--pin 1234] [--remove]` | Emergency: make an account admin (or remove it), optionally with a new PIN. Uses `.env.local` |

## API

| Route | What it does |
| --- | --- |
| `GET /api/stats` | `{ total, today, month, dayKey }`, cached on the server for about 3 seconds |
| `POST /api/durood` | Body `{ deviceId, count, mode, clientId }`. Adds a count and returns the new totals. A retry with the same `clientId` is never counted twice. |
| `POST /api/device` | Links the browser's anonymous device id with its httpOnly cookie |
| `GET /api/me?deviceId=` | This device's own counts and last 7 days (private, never cached) |
| `POST /api/auth/signup` · `POST /api/auth/login` | Body `{ phone, pin }`. Creates or opens an account and sets the session cookie |
| `POST /api/auth/logout` | Logs out this phone, or every phone with `{ all: true }` |
| `GET /api/auth/me` | The logged-in user (masked number, profile) or `null` |
| `POST /api/auth/pin` | Body `{ oldPin, newPin }` |
| `POST /api/profile` | Body `{ name, majlis, majlisOther, age, city }` (all optional) |
| `GET /api/majalis` | The active majlis list for the profile form |
| `GET /api/health` | Database check |

Admin actions are Server Actions, each checking the admin session first.

## Privacy and security

- Accounts are a mobile number + 4-digit PIN (bcrypt-hashed). Wrong PINs lock the account for 15 minutes after 5 tries, 1 hour after 10, 24 hours after 15. Sessions are random tokens in an httpOnly cookie; only their hash is stored. No OTP yet, so the admin resets forgotten PINs.
- IPs are never stored, only a salted SHA-256 hash used for rate limits. Device ids are never shown publicly.
- The leaderboard and public profiles show name, majlis, city, age and counts. Phone numbers are never shown. These pages are `noindex`.
- Every input is validated with Zod. Totals only change with atomic `$inc`; each submission has a unique id, so retries can't double count.
- Rate limits: 30 submissions per minute per account and 120 per IP; 30 wrong PINs per 15 minutes and 30 new accounts per hour per IP (successful logins and typos don't count); 5 admin logins per 15 minutes per IP.
- Admin: bcrypt-checked password, signed httpOnly `SameSite=Strict` session cookie (12 hours).
- Security headers: Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy.

## Tests

`npm test` runs the unit tests: number formatting, Karachi dates, the offline tap queue, the counter service (atomic increments, idempotency, limits), accounts (sign-up, login, lockouts, PIN changes, profiles), personal counts, and the admin tools. The service tests start a throwaway MongoDB with mongodb-memory-server; the first run downloads a MongoDB binary (several hundred MB) into `node_modules/.cache`.

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
