import { UserRoundIcon } from "lucide-react";
import { formatCount, type NumberLocale } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Position on the leaderboard; the top three get the gold accent. */
export function RankBadge({ rank, locale, className }: { rank: number; locale: NumberLocale; className?: string }) {
  return (
    <span
      className={cn(
        "num grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
        rank === 1 && "bg-gold text-primary",
        rank === 2 && "bg-gold/60 text-primary",
        rank === 3 && "bg-gold/35 text-foreground",
        rank > 3 && "bg-muted text-muted-foreground",
        className,
      )}
    >
      {formatCount(rank, locale)}
    </span>
  );
}

/** First letter of the name on a green circle, or a person icon when there's no name. */
export function Avatar({ name, className }: { name: string; className?: string }) {
  const letter = [...name.trim()][0];
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-brand",
        className,
      )}
    >
      {letter ? <span className="leading-none">{letter.toUpperCase()}</span> : <UserRoundIcon className="size-1/2" />}
    </span>
  );
}
