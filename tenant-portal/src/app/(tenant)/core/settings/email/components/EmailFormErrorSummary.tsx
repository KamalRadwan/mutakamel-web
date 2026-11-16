"use client";

import { AlertCircle } from "lucide-react";
import { cn, iconSize, proseMeasure } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { focusEmailField, type EmailErrorSummaryItem } from "../email-form-navigation";

interface EmailFormErrorSummaryProps {
  items: readonly EmailErrorSummaryItem[];
}

export function EmailFormErrorSummary({ items }: EmailFormErrorSummaryProps) {
  const { t } = useI18n();
  if (items.length === 0) return null;

  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-1.5 rounded-md border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground",
        proseMeasure,
      )}
    >
      <div className="flex items-center gap-1.5 font-medium">
        <AlertCircle className={iconSize({ size: "sm" })} aria-hidden="true" />
        <span>{formatTemplate(t.crmShared.formErrorCount, { count: items.length })}</span>
      </div>
      <ul className="flex flex-col gap-1 ps-5">
        {items.map((item) => (
          <li key={item.field} className="list-disc">
            <a
              href={`#${item.anchorId}`}
              onClick={(event) => {
                event.preventDefault();
                focusEmailField(item.anchorId);
              }}
              className="rounded-xs underline underline-offset-2 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {`${item.label}: ${item.message}`}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
