import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { ShareButtons } from "./share-buttons";

/** Invite others. Only the shared total is ever included here. */
export function ShareSection() {
  const t = useTranslations("Share");
  return (
    <Card id="share" className="scroll-mt-20 gap-0 py-5">
      <CardContent className="flex flex-col items-center gap-3 text-center">
        <h2 className="text-lg leading-loose font-semibold text-brand">{t("heading")}</h2>
        <p className="text-sm text-muted-foreground">{t("sub")}</p>
        <ShareButtons />
      </CardContent>
    </Card>
  );
}
