import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatCount, type NumberLocale } from "@/lib/format";
import type { AdminEntry } from "@/server/admin";
import { BlockButton, EntryActions } from "./entry-actions";
import { formatKarachiTime, shortDevice } from "./format";

/** One entry: size, time, mode, shortened device (links to its entries). Never the IP. */
export function EntryCard({ entry, locale }: { entry: AdminEntry; locale: NumberLocale }) {
  const t = useTranslations("Admin");
  return (
    <li className="space-y-2 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="num text-xl font-bold text-brand">{formatCount(entry.count, locale)}</span>
        <Badge variant="secondary">{entry.mode === "tap" ? t("modeTap") : t("modeNumber")}</Badge>
        {entry.removed && <Badge variant="destructive">{t("removedBadge")}</Badge>}
        <span className="num ms-auto text-xs text-muted-foreground">{formatKarachiTime(entry.createdAt, locale)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <Link
          href={{ pathname: "/admin/entries", query: { device: entry.deviceId } }}
          className="num rounded bg-muted px-1.5 py-0.5 text-foreground hover:underline"
          dir="ltr"
        >
          {shortDevice(entry.deviceId)}
        </Link>
        <span className="truncate" dir="ltr">
          {entry.userAgentShort || "—"}
        </span>
      </div>
      {entry.removed ? (
        <div className="flex flex-wrap items-center gap-2">
          {entry.removedReason && (
            <p className="flex-1 text-xs text-muted-foreground">{t("reasonLabel", { reason: entry.removedReason })}</p>
          )}
          {/* Removing spam and then blocking its device is the usual next step. */}
          <BlockButton deviceId={entry.deviceId} />
        </div>
      ) : (
        <EntryActions id={entry.id} deviceId={entry.deviceId} count={formatCount(entry.count, locale)} />
      )}
    </li>
  );
}
