import { Badge } from "@/design-system";
import { formatTemplateDifferenceValue, type TemplateConflictComparison, type TemplateDifferenceValue } from "../../template-conflict-comparison";
import type { TemplateConflictCopy } from "@/i18n/dictionaries/template-conflict";

export function TemplateConflictDifferenceList({ comparison, copy, locale }: {
  comparison: TemplateConflictComparison; copy: TemplateConflictCopy; locale: string;
}) {
  const number = new Intl.NumberFormat(locale);
  if (!comparison.total) return <p role="status" className="text-sm text-muted-foreground">{copy.unchanged}</p>;
  return <section className="grid min-w-0 gap-3" aria-label={copy.compare}>
    <dl className="grid gap-2 sm:grid-cols-2">
      {(Object.keys(comparison.counts) as (keyof typeof comparison.counts)[]).map(side => <div key={side} className="flex items-start justify-between gap-2 rounded-md border border-border p-3">
        <dt className="text-sm">{copy.side[side]}</dt><dd><bdi>{number.format(comparison.counts[side])}</bdi></dd>
      </div>)}
    </dl>
    {comparison.truncated && <p role="status" className="text-sm text-muted-foreground">{copy.more}</p>}
    <ol className="grid gap-3">
      {comparison.differences.map(difference => <li key={JSON.stringify(difference.path)} className="grid min-w-0 gap-3 rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 break-words font-medium">{difference.nodeId ? difference.nodeName ?? copy.unnamed : copy.document}</h3>
          <Badge tone="neutral">{copy.area[difference.area]}</Badge>
          <span className="text-sm text-muted-foreground">{copy.field[difference.path.at(-1) as keyof typeof copy.field] ?? copy.area[difference.area]}</span>
          <Badge tone={difference.side === "conflict" ? "caution" : "neutral"}>{copy.side[difference.side]}</Badge>
        </div>
        <dl className="grid min-w-0 gap-3 md:grid-cols-3">
          <DifferenceValue title={copy.base} value={difference.base} copy={copy} />
          <DifferenceValue title={copy.local} value={difference.local} copy={copy} />
          <DifferenceValue title={copy.saved} value={difference.saved} copy={copy} />
        </dl>
      </li>)}
    </ol>
  </section>;
}

function DifferenceValue({ title, value, copy }: { title: string; value: TemplateDifferenceValue; copy: TemplateConflictCopy }) {
  const formatted = formatTemplateDifferenceValue(value);
  return <div className="min-w-0 space-y-1">
    <dt className="text-sm text-muted-foreground">{title}</dt>
    <dd className="whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">
      {formatted ? <bdi dir="auto">{formatted.text || copy.empty}</bdi> : copy.missing}
      {formatted?.truncated && <span className="block text-xs text-muted-foreground">{copy.shortened}</span>}
    </dd>
  </div>;
}
