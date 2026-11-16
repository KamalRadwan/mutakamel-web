"use client";

import { useId } from "react";
import { AlertCircle } from "lucide-react";
import { cn, focusRing, iconSize, proseMeasure } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import type { TaxErrorSummaryItem } from "../tax-validation";

export interface TaxFormErrorSummaryProps {
  items: readonly TaxErrorSummaryItem[];
  onNavigate: (event: React.MouseEvent<HTMLAnchorElement>, anchorId: string) => void;
}

export function TaxFormErrorSummary({ items, onNavigate }: TaxFormErrorSummaryProps) {
  const { t } = useI18n();
  const headingId = useId();
  if (items.length === 0) return null;

  return (
    <div
      role="alert"
      aria-labelledby={headingId}
      className={cn(
        "flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground",
        proseMeasure,
      )}
    >
      <AlertCircle className={cn(iconSize({ size: "sm" }), "mt-0.5 shrink-0")} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1">
        <span id={headingId} className="font-medium">
          {formatTemplate(t.crmShared.formErrorCount, { count: items.length })}
        </span>
        <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {items.map((item) => (
            <li key={item.field}>
              <a
                href={`#${item.anchorId}`}
                onClick={(event) => onNavigate(event, item.anchorId)}
                className={cn(
                  "rounded-xs font-medium underline underline-offset-2 hover:opacity-90",
                  focusRing,
                )}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
