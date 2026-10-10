# Deploying Noor-e-Durood on Hostinger

This guide deploys the app as a **Node.js web app** in Hostinger's hPanel, straight from GitHub, with the database on MongoDB Atlas. You need a Hostinger plan that includes Node.js web apps (Business Web Hosting or a Cloud plan) and the GitHub repository.

Menu names below are the ones Hostinger uses today; if a label looks slightly different in your hPanel, look for the closest match.

---

## 1. Prepare MongoDB Atlas

1. **Database user**: in Atlas, open **Database Access → Add New Database User**. Use a long random password and give it **Read and write** on the `noor_e_durood` database (or "readWriteAnyDatabase" if you prefer).
2. **Network access**: open **Network Access → Add IP Address**.
   - Hostinger's shared and cloud plans don't give the app a fixed outgoing IP you can rely on, so choose **Allow access from anywhere** (`0.0.0.0/0`). The database is still protected by the user's password and TLS.
   - If Hostinger support gives you a fixed outgoing IP for your plan, add only that IP instead.
3. **Connection string**: open your cluster → **Connect → Drivers** and copy the `mongodb+srv://…` string. Put the user's password in it. If the password has special characters (`@ : / ? # %`), URL-encode them.

## 2. Prepare the secrets (on your computer)

Run these in the project folder:

```bash
# A long random salt for hashing visitor IPs (keep it forever; changing it
# resets per-IP rate limits and invalidates recovery codes)
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"

# A bcrypt hash of your admin password (the plain password is never stored)
npm run admin:hash -- "your long admin password"
```

`admin:hash` prints two lines. Use the **first** one (plain `$` signs) for Hostinger. The second one, with `\$`, is only for a local `.env.local` file.

## 3. Seed the database once

The app creates what it needs on its own, but seeding first gives you the counters and the Settings document right away. From your computer:

1. Put the production values in `.env.local` (at least `MONGODB_URI` and `MONGODB_DB=noor_e_durood`).
2. Run:

   ```bash
   npm run db:seed
   ```

It only creates what is missing and never touches existing counts, so it is safe to run again later (for example to add new Settings fields). `npm run db:seed -- --reset` wipes all counts and entries, so don't run that on the live database unless you mean it.

## 4. Create the app in hPanel

1. **Websites → Add Website → Node.js web app → Import Git repository**.
2. **Connect with GitHub**, install the Hostinger GitHub App, and give it access to the `Noor-e-Durood` repository.
3. Select the repository and set:

   | Setting | Value |
   | --- | --- |
   | Framework / Application type | **Next.js** (auto-detected) |
   | Branch | `main` |
   | Node.js version | **22** (or 24). Must be 22.12 or newer |
   | Root directory | `/` (leave empty) |
   | Build command / Build script | `build` (runs `npm run build`, which also builds the service worker) |
   | Output directory | `.next` |
   | Entry file | leave empty (ignored for Next.js) |
   | Package manager | npm |

4. **Environment variables** (add them before the first deploy; they apply to both build and runtime):

   | Name | Value |
   | --- | --- |
   | `MONGODB_URI` | the Atlas `mongodb+srv://…` string |
   | `MONGODB_DB` | `noor_e_durood` |
   | `IP_HASH_SALT` | the random salt from step 2 |
   | `ADMIN_PASSWORD` | the bcrypt hash from step 2 (starts with `$2b$12$`) |
   | `NEXT_PUBLIC_SITE_URL` | your final address, e.g. `https://durood.example.com` (no trailing slash) |

   - `NEXT_PUBLIC_SITE_URL` is baked in **at build time** (share links, sitemap, preview images). If you change it, redeploy.
   - Don't set `NODE_ENV` or `PORT` yourself. Hostinger provides the port and `next start` reads `PORT` automatically.

5. Click **Deploy** and watch the build log under **Deployments**. A good build ends with `✓ Service worker: public/sw.js …`.

## 5. Domain or subdomain, and SSL

1. In hPanel, connect your domain (or a subdomain such as `durood.example.com`) to the Node.js app from the website's dashboard. If the domain's DNS is elsewhere, add the A/CNAME records hPanel shows you.
2. Turn on the free **SSL certificate** for that domain and make sure the site opens on `https://`. Installing the app and the offline mode only work over https.
3. If the address differs from what you put in `NEXT_PUBLIC_SITE_URL`, update that variable and **Redeploy**.

## 6. Check that it works

- `https://your-domain/api/health` shows `{"ok":true,"db":"up"}`.
- The home page shows the live counter; add a test durood and see it count.
- `https://your-domain/admin` asks for the password; log in with the plain password you hashed.
- `https://your-domain/robots.txt` and `/sitemap.xml` show your real domain.
- Share the link in WhatsApp (or test it on a link-preview site) and check the preview image.
- Run [PageSpeed Insights](https://pagespeed.web.dev/) on the live URL.
- On an Android phone in Chrome, the "Install" card appears on the home page.

If you added test durood while checking, remove them in **Admin → Entries** (they are subtracted from all totals).

## 7. Updating the site

Push to `main`. Hostinger rebuilds and restarts automatically (look for the **Auto-deployment** chip). Use **Redeploy** on the dashboard to rebuild without a new commit. Build logs are under **Deployments**; app errors are under **Runtime Logs**.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Build fails | The build log under Deployments. Node.js version (22+). All environment variables present. |
| `Invalid environment variables` in logs | The message lists the variable names that are missing or wrong. |
| `/api/health` says `"db":"down"` | Atlas Network Access (step 1.2), the user's password in `MONGODB_URI`, and that the cluster isn't paused. |
| Admin password not accepted | `ADMIN_PASSWORD` must be the exact hash, starting `$2b$12$`, with nothing else around it. Wait 15 minutes after 5 wrong tries. |
| Share links or sitemap show the wrong address | Fix `NEXT_PUBLIC_SITE_URL`, then Redeploy. |
| Changes to Settings not visible | Notices update within a minute and submissions within about 10 seconds. |
