import type { PageConfig } from "../page-contract";

/** Geometry only: asset artwork is displayed by the qualified native renderer. */
export function PageGeometryPreview({ page, label, size }: { page: PageConfig; label: string; size: string }) {
  const width = page.widthMm - page.marginMm.start - page.marginMm.end, height = page.heightMm - page.marginMm.top - page.marginMm.bottom;
  if (![page.widthMm, page.heightMm, width, height].every(value => Number.isFinite(value) && value > 0)) return null;
  return <figure aria-label={label} className="mx-auto w-full max-w-80 rounded-lg border border-border bg-muted p-3">
    <div className="relative border border-border bg-card" style={{ aspectRatio: `${page.widthMm} / ${page.heightMm}` }}>
      <div className="absolute flex items-center justify-center border border-dashed border-brand-500 p-2 text-center text-sm text-foreground" style={{
        insetBlockStart: `${page.marginMm.top / page.heightMm * 100}%`, insetInlineStart: `${page.marginMm.start / page.widthMm * 100}%`,
        inlineSize: `${width / page.widthMm * 100}%`, blockSize: `${height / page.heightMm * 100}%`,
      }}>{size}</div>
    </div>
    <figcaption className="mt-2 text-center text-sm text-muted-foreground">{label}</figcaption>
  </figure>;
}
