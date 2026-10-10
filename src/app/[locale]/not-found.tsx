import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-4 py-20 text-center">
      <p className="num text-5xl font-semibold text-gold">404</p>
      <h1 className="text-xl text-brand">{t("title")}</h1>
      <Button asChild className="h-11 rounded-full px-6">
        <Link href="/">{t("back")}</Link>
      </Button>
    </div>
  );
}
