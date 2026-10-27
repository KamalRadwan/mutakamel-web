"use client";

import { forwardRef } from "react";
import { useLanguage } from "@/i18n/useLanguage";
import { formatNumber } from "@/lib/format/number";
import { cn } from "../../lib/cn";
import { focusRing, hitTarget } from "../../lib/variants";

export type KpiBadgeTone = "total" | "new" | "rated" | "qualified" | "overdue";

export interface KpiBadgeProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  tone: KpiBadgeTone;
  label: string;
  count: number | null;
  icon?: React.ReactNode;
  pressed?: boolean;
}

interface KpiToneClasses {
  button: string;
  pressed: string;
  count: string;
}

// Written out statically so Tailwind v4's scanner emits every tone utility.
const KPI_TONE_CLASSES: Record<KpiBadgeTone, KpiToneClasses> = {
  total: {
    button: "bg-kpi-total-surface border-kpi-total-line text-kpi-total-text",
    pressed: "ring-2 ring-kpi-total-line",
    count: "bg-kpi-total-count",
  },
  new: {
    button: "bg-kpi-new-surface border-kpi-new-line text-kpi-new-text",
    pressed: "ring-2 ring-kpi-new-line",
    count: "bg-kpi-new-count",
  },
  rated: {
    button: "bg-kpi-rated-surface border-kpi-rated-line text-kpi-rated-text",
    pressed: "ring-2 ring-kpi-rated-line",
    count: "bg-kpi-rated-count",
  },
  qualified: {
    button: "bg-kpi-qualified-surface border-kpi-qualified-line text-kpi-qualified-text",
    pressed: "ring-2 ring-kpi-qualified-line",
    count: "bg-kpi-qualified-count",
  },
  overdue: {
    button: "bg-kpi-overdue-surface border-kpi-overdue-line text-kpi-overdue-text",
    pressed: "ring-2 ring-kpi-overdue-line",
    count: "bg-kpi-overdue-count",
  },
};

export const KpiBadge = forwardRef<HTMLButtonElement, KpiBadgeProps>(
  ({ tone, label, count, icon, pressed, className, type = "button", ...props }, ref) => {
    const lang = useLanguage();
    const styles = KPI_TONE_CLASSES[tone];

    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={pressed}
        aria-busy={count === null ? true : undefined}
        className={cn(
          "inline-flex h-6 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border ps-[7.5px] pe-[5px] text-badge font-semibold transition-colors not-disabled:hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50",
          hitTarget,
          focusRing,
          styles.button,
          pressed && styles.pressed,
          className,
        )}
        {...props}
      >
        {icon !== undefined && icon !== null && (
          <span
            aria-hidden="true"
            className="inline-flex size-[11.5px] shrink-0 items-center justify-center [&>svg]:size-[11.5px]"
          >
            {icon}
          </span>
        )}
        <span className="text-badge leading-none">{label}</span>
        {count === null ? (
          <span
            aria-hidden="true"
            data-slot="kpi-count-placeholder"
            className={`inline-block h-4 min-w-[17px] shrink-0 rounded-sm opacity-35 ${styles.count}`}
          />
        ) : (
          <span
            className={`inline-flex h-4 min-w-[17px] shrink-0 items-center justify-center rounded-sm px-[4.5px] text-micro font-bold leading-none tabular-nums text-white ${styles.count}`}
          >
            {formatNumber(count, lang)}
          </span>
        )}
      </button>
    );
  },
);
KpiBadge.displayName = "KpiBadge";
