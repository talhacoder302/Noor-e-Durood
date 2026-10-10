import { Fragment } from "react";

const SALAWAT = "ﷺ";

/**
 * Renders text with every ﷺ set in Amiri. Noto Nastaliq draws ﷺ as a tall
 * stacked glyph that collides with neighbouring lines; Amiri's is compact.
 */
export function SalawatText({ children }: { children: string }) {
  const parts = children.split(SALAWAT);
  if (parts.length === 1) return children;

  return parts.map((part, i) => (
    <Fragment key={i}>
      {part}
      {i < parts.length - 1 && <span className="salawat">{SALAWAT}</span>}
    </Fragment>
  ));
}
