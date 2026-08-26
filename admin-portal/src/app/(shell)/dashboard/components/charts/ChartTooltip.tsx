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
    <div className="bg-card border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-xl text-xs space-y-1.5 min-w-[140px] z-50 animate-in fade-in duration-100">
      {label && (
        <div className="font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/80 pb-1">
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
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                {item.name || item.dataKey}
              </span>
            </div>
            <span className="font-semibold font-mono text-slate-900 dark:text-slate-100">
              {valueFormatter(item.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
