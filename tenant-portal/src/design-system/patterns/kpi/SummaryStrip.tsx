"use client";

import type { LucideIcon } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { cn } from "../../lib/cn";
import { SWATCH_SURFACE_PALETTES, type SwatchHue } from "../../lib/swatch-palette";

interface SummaryMetric {
  label: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  hue: SwatchHue;
}

export function SummaryStrip({ items }: { items: readonly SummaryMetric[] }) {
  const { lang } = useI18n();
  return (
    <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      {items.map(({ label, value, description, icon: Icon, hue }) => {
        const palette = SWATCH_SURFACE_PALETTES[hue];
        return (
          <div key={label} title={description}
            className={cn("flex min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2", palette.sectionCard)}>
            <dt className="flex min-w-0 items-center gap-2">
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", palette.iconBoxIdle)}>
                <Icon className="size-3.5" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium text-foreground">{label}</span>
              {description && <span className="sr-only">{description}</span>}
            </dt>
            <dd className="shrink-0 text-base font-semibold tabular-nums text-foreground">
              {typeof value === "number" ? formatNumber(value, lang) : value}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
