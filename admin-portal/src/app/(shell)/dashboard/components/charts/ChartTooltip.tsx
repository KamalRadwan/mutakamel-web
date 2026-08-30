"use client";

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string;
  valueFormatter?: (value: unknown, item: ChartTooltipPayloadItem) => string;
}

interface ChartTooltipPayloadItem {
  color?: string;
  fill?: string;
  name?: string;
  dataKey?: string | number;
  value?: unknown;
}

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter = (val) => String(val),
}: ChartTooltipProps) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="z-50 min-w-36 animate-in space-y-1.5 rounded-lg border border-border bg-card p-3 text-xs shadow-pop fade-in duration-100 motion-reduce:animate-none">
      {label && (
        <div className="border-b border-border pb-1 font-semibold text-foreground">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={`${item.dataKey ?? item.name ?? "item"}-${index}`} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: item.color || item.fill }}
              />
              <span className="font-medium text-muted-foreground">
                {item.name || item.dataKey}
              </span>
            </div>
            <span className="font-mono font-semibold tabular-nums text-foreground" dir="auto">
              {valueFormatter(item.value, item)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
