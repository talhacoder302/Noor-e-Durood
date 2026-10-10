import { useTranslations } from "next-intl";
import { SalawatText } from "./salawat-text";

// Keep the diacritics exactly as written. Do not retype or "clean up" this
// string; copy it from a verified source if it ever needs to change.
export const SHORT_DUROOD = "صَلَّى ٱللَّٰهُ عَلَيْهِ وَآلِهِ وَسَلَّمَ";

export function ShortDurood() {
  const t = useTranslations("Hero");

  return (
    <figure className="rounded-2xl border border-gold/30 bg-card/80 px-5 py-6 text-center shadow-sm">
      <figcaption className="mb-3 text-xs text-muted-foreground">
        {t("shortDuroodLabel")}
      </figcaption>
      <p lang="ar" dir="rtl" className="arabic-text text-3xl text-brand sm:text-4xl">
        {SHORT_DUROOD}
      </p>
      <p className="mt-3 text-sm text-muted-foreground">
        <SalawatText>{t("shortDuroodTranslation")}</SalawatText>
      </p>
    </figure>
  );
}
