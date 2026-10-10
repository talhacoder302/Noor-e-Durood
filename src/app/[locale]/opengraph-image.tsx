import { readFile } from "node:fs/promises";
import path from "node:path";
import { unstable_rethrow } from "next/navigation";
import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { countInWords, formatCount, type NumberLocale } from "@/lib/format";
import { getCachedTotalsForPreview } from "@/server/stats";

export const alt = "Noor-e-Durood";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Satori (next/og) can't shape Arabic script, so Urdu/Arabic words are
// pre-rendered PNGs (made in a real browser, see CLAUDE.md). Only Latin text
// and digits are drawn here.
const assetDir = path.join(process.cwd(), "src/assets/og");

async function png(file: string) {
  const data = await readFile(path.join(assetDir, file));
  return `data:image/png;base64,${data.toString("base64")}`;
}

async function loadAssets() {
  const [durood, nameUr, labelUr, inviteUr, interBold, interMedium] = await Promise.all([
    png("og-durood.png"),
    png("og-name-ur.png"),
    png("og-total-label-ur.png"),
    png("og-invite-ur.png"),
    readFile(path.join(assetDir, "Inter-Bold.woff")),
    readFile(path.join(assetDir, "Inter-Medium.woff")),
  ]);
  return { durood, nameUr, labelUr, inviteUr, interBold, interMedium };
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await connection();
  const { locale } = await params;
  const lang: NumberLocale = locale === "en" ? "en" : "ur";

  let total: number | null = null;
  try {
    total = (await getCachedTotalsForPreview()).total;
  } catch (error) {
    unstable_rethrow(error);
    console.error("OG image: totals unavailable", error);
  }

  const a = await loadAssets();
  const gold = "#d6b25a";
  const cream = "#fbf8f1";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f5132",
          color: cream,
          fontFamily: "Inter",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            right: 24,
            bottom: 24,
            border: `2px solid ${gold}`,
            borderRadius: 28,
            opacity: 0.45,
            display: "flex",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={a.durood} height={74} alt="" />
        <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 4 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.nameUr} height={150} alt="" />
          <div style={{ width: 2, height: 90, background: gold, opacity: 0.6, display: "flex" }} />
          <div style={{ fontSize: 50, fontWeight: 700, letterSpacing: -0.5 }}>Noor-e-Durood</div>
        </div>

        {total !== null && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 8 }}>
            {lang === "ur" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.labelUr} height={70} alt="" />
            ) : (
              <div style={{ fontSize: 34, fontWeight: 500, color: "#e9d9a6" }}>Durood sent so far</div>
            )}
            <div style={{ fontSize: 112, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>
              {formatCount(total, lang)}
            </div>
            {lang === "en" && total >= 1000 && (
              <div style={{ fontSize: 30, fontWeight: 500, color: "#e9d9a6", marginTop: 8 }}>{countInWords(total, "en")}</div>
            )}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18 }}>
          {lang === "ur" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.inviteUr} height={60} alt="" />
          ) : (
            <div style={{ fontSize: 30, fontWeight: 500 }}>Join in and add your durood</div>
          )}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: a.interBold, weight: 700, style: "normal" },
        { name: "Inter", data: a.interMedium, weight: 500, style: "normal" },
      ],
      // Crawlers and CDNs may reuse it for a few minutes.
      headers: { "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600" },
    },
  );
}
