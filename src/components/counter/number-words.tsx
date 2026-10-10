import { countInWords, type NumberLocale } from "@/lib/format";

/** "1 کروڑ 23 لاکھ" with the digits set in the number font. */
export function NumberWords({
  value,
  locale,
  className,
}: {
  value: number;
  locale: NumberLocale;
  className?: string;
}) {
  const words = countInWords(value, locale);
  if (!words) return null;

  return (
    <p className={className}>
      {words.split(/([\d,]+)/).map((part, i) =>
        /\d/.test(part) ? (
          <span key={i} className="num">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}
