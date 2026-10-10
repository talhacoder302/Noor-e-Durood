import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Link } from "@/i18n/navigation";
import { formatCount, type NumberLocale } from "@/lib/format";
import type { AdminEntry } from "@/server/admin";
import { DisableUserButton, RemoveEntryButton } from "./entry-actions";
import { formatKarachiTime, shortDevice } from "./format";

/** One entry: size, time, mode, who sent it (links to their entries). Never the IP. */
export function EntryCard({ entry, locale }: { entry: AdminEntry; locale: NumberLocale }) {
  const t = useTranslations("Admin");
  const who = entry.user ? entry.user.name || entry.user.phone : null;

  return (
    <li className="space-y-2 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="num text-xl font-bold text-brand">{formatCount(entry.count, locale)}</span>
        <Badge variant="secondary">{entry.mode === "tap" ? t("modeTap") : t("modeNumber")}</Badge>
        {entry.removed && <Badge variant="destructive">{t("removedBadge")}</Badge>}
        {entry.user?.disabled && <Badge variant="outline">{t("disabledBadge")}</Badge>}
        <span className="num ms-auto text-xs text-muted-foreground">{formatKarachiTime(entry.createdAt, locale)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {entry.user ? (
          <Link
            href={{ pathname: "/admin/entries", query: { user: entry.user.id } }}
            className="rounded bg-muted px-1.5 py-0.5 text-foreground hover:underline"
          >
            {who}
            {entry.user.name && (
              <span className="num ms-1.5 text-muted-foreground" dir="ltr">
                {entry.user.phone}
              </span>
            )}
          </Link>
        ) : (
          // Entries from before accounts only have a device.
          <Link
            href={{ pathname: "/admin/entries", query: { device: entry.deviceId } }}
            className="num rounded bg-muted px-1.5 py-0.5 text-foreground hover:underline"
            dir="ltr"
          >
            {shortDevice(entry.deviceId)}
          </Link>
        )}
        {entry.majlisName && <span>{entry.majlisName}</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {entry.removed && entry.removedReason && (
          <p className="flex-1 text-xs text-muted-foreground">{t("reasonLabel", { reason: entry.removedReason })}</p>
        )}
        {!entry.removed && <RemoveEntryButton id={entry.id} count={formatCount(entry.count, locale)} />}
        {/* Removing spam and then turning off the account is the usual next step. */}
        {entry.user && !entry.user.disabled && <DisableUserButton userId={entry.user.id} label={who ?? ""} />}
      </div>
    </li>
  );
}
