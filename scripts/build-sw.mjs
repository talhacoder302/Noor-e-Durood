// Builds public/sw.js after `next build`: bundles src/sw/sw.ts with esbuild
// and injects the Serwist precache manifest (app chunks, fonts, icons and
// the offline pages). Serwist's Turbopack route needs route segment config
// that cacheComponents doesn't allow, so we do this step ourselves.
import fs from "node:fs";
import { getManifest } from "@serwist/build";
import esbuild from "esbuild";

const buildId = fs.readFileSync(".next/BUILD_ID", "utf8").trim();

const { manifestEntries, count, size, warnings } = await getManifest({
  globDirectory: ".next",
  // All font files too: Amiri isn't preloaded, but the offline page needs it.
  // This happens in the background after the first visit.
  globPatterns: ["static/**/*.{js,css,woff2}"],
  modifyURLPrefix: { "static/": "/_next/static/" },
  // File names under /_next/static are already content-hashed.
  dontCacheBustURLsMatching: /^\/_next\/static\//,
  maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
  additionalPrecacheEntries: [
    // Served when a page can't load offline; includes a working tasbeeh.
    { url: "/offline", revision: buildId },
    { url: "/en/offline", revision: buildId },
    { url: "/manifest.webmanifest", revision: buildId },
    { url: "/icons/icon-192.png", revision: buildId },
    { url: "/icons/icon-512.png", revision: buildId },
  ],
});

for (const warning of warnings) console.warn("sw:", warning);

const result = await esbuild.build({
  entryPoints: ["src/sw/sw.ts"],
  bundle: true,
  format: "iife",
  target: "es2020",
  platform: "browser",
  minify: true,
  write: false,
  define: {
    "process.env.NODE_ENV": '"production"',
    "self.__SW_MANIFEST": JSON.stringify(manifestEntries),
  },
});

fs.writeFileSync("public/sw.js", result.outputFiles[0].text);
console.log(
  `✓ Service worker: public/sw.js (${(result.outputFiles[0].text.length / 1024).toFixed(1)} KiB), ` +
    `${count} precached files (${(size / 1024).toFixed(0)} KiB) + offline pages`,
);
