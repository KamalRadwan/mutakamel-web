"use client";
import type { PageController } from "../page-controller";
import { usePageGuides } from "../hooks/usePageGuides";

/** Mount beside, outside the trusted native measurement/capture root, under its existing zoom transform. */
export function PageGuides({ controller, locale, direction }: { controller: PageController; locale: "ar-EG" | "en-US"; direction: "LTR" | "RTL" }) {
  const { page, printBounds, rulers, horizontal, vertical } = usePageGuides(controller, locale);
  if (!page) return null;
  return <div aria-hidden="true" data-template-editor-guide="" dir={direction.toLowerCase()} className="pointer-events-none absolute start-0 top-0 select-none"
    style={{ inlineSize: `${page.widthMm}mm`, blockSize: `${page.heightMm}mm` }}>
    {printBounds && <div className="absolute border border-dashed border-brand-500" style={{
      insetBlockStart: `${page.marginMm.top}mm`, insetInlineStart: `${page.marginMm.start}mm`,
      inlineSize: `${page.widthMm - page.marginMm.start - page.marginMm.end}mm`, blockSize: `${page.heightMm - page.marginMm.top - page.marginMm.bottom}mm`,
    }} />}
    {rulers && <>
      <div className="absolute start-0 -top-6 h-5 w-full border-b border-border bg-card text-foreground">
        {horizontal.map(tick => <span key={tick.mm} className="absolute top-0 h-5 border-s border-border ps-1 text-xs" style={{ insetInlineStart: `${tick.mm}mm` }}>{tick.label}</span>)}
      </div>
      <div className="absolute -start-8 top-0 h-full w-7 border-e border-border bg-card text-foreground">
        {vertical.map(tick => <span key={tick.mm} className="absolute start-0 w-7 border-t border-border text-xs" style={{ insetBlockStart: `${tick.mm}mm` }}>{tick.label}</span>)}
      </div>
    </>}
  </div>;
}
