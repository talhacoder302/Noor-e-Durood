import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PublicProfileSkeleton, PublicProfileView } from "@/components/leaderboard/public-profile";

type Params = { params: Promise<{ locale: string; id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Leaderboard" });
  return { title: t("profileTitle"), robots: { index: false, follow: false } };
}

// The id is only known at request time, so the whole page streams in behind
// the skeleton; the header and nav around it are the static shell.
export default function PublicProfilePage({ params }: Params) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5 px-4 pt-4 pb-12 sm:pt-8">
      <Suspense fallback={<PublicProfileSkeleton />}>
        <PublicProfileView params={params} />
      </Suspense>
    </div>
  );
}
