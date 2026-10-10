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

3. Create the database, collections and the global counter (safe to run again):

   ```bash
   npm run db:init
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   - Urdu: http://localhost:3000
   - English: http://localhost:3000/en
   - Database check: http://localhost:3000/api/health should return `{"ok":true,"db":"up"}`

## Scripts

| Command             | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm run dev`       | Development server                           |
| `npm run build`     | Production build                             |
| `npm start`         | Run the production build                     |
| `npm run lint`      | ESLint                                       |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`)            |
| `npm test`          | Unit tests (Vitest)                          |
| `npm run db:init`   | Create the database and seed the global counter |

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
    counter/        counter components
  i18n/             routing, request config and Urdu/English messages
scripts/            one-off Node scripts (database setup)
```

## Deploying (Hostinger Node.js)

1. Set the same environment variables in the hosting panel.
2. Build with `npm run build` and start with `npm start`.
3. Allow the host's outbound IP in Atlas Network Access.
