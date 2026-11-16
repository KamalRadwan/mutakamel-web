import type { ReactNode } from "react";
interface Props {
  position: unknown;
  entries: Array<{ key: string; label: string; fill?: string }>;
  children: ReactNode;
}
/** Logical placement keeps start/end consistent with the document direction. */
export function WidgetLegend({ position, entries, children }: Props) {
  const side = position === "start" || position === "end";
  const before = position === "top" || position === "start";
  return <div data-legend-position={String(position)} className={`flex min-w-0 gap-2 ${side ? "flex-row items-center" : "flex-col"}`}>
    <div className={`min-w-0 flex-1 ${before ? "order-2" : "order-1"}`}>{children}</div>
    {position !== "none" && <ul className={`flex flex-wrap gap-x-3 gap-y-1 text-2xs text-muted-foreground ${side ? "max-w-28 flex-col" : "justify-center"} ${before ? "order-1" : "order-2"}`}>
      {entries.map((entry) => <li key={entry.key} className="flex items-center gap-1.5"><span className="size-2 shrink-0 rounded-full bg-primary" style={{ backgroundColor: entry.fill }} aria-hidden="true" /><span>{entry.label}</span></li>)}
    </ul>}
  </div>;
}
