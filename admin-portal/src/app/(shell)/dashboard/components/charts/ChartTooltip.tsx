"use client";

interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipPayloadItem[];
  label?: string;
  valueFormatter?: (value: unknown) => string;
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
    <div className="min-w-[140px] z-50 animate-in fade-in duration-100 space-y-1.5 rounded-lg border border-border bg-card p-3 text-xs shadow-pop">
      {label && (
        <div className="border-b border-border pb-1 font-semibold text-foreground">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((item, index) => (
          <div key={`item-${index}`} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: item.color || item.fill }}
              />
              <span className="font-medium text-muted-foreground">
                {item.name || item.dataKey}
              </span>
            </div>
            <span className="font-semibold font-mono text-foreground">
              {valueFormatter(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
