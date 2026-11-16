"use client";

import { Minus, Plus } from "lucide-react";
import { Button, Field, Input, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { stepQuotationQuantity } from "../quotation-presentation";

export function QuotationQuantityControl({
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  compact = false,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  disabled?: boolean;
  compact?: boolean;
  label?: string;
}) {
  const { t } = useI18n();
  const copy = t.quotationExperience;
  const resolvedLabel = label ?? copy.quantity;

  if (compact) {
    return (
      <Field label={resolvedLabel} error={error} className={cn("ms-auto w-16", !error && "gap-0", error && "w-28 gap-0.5")}>
        <Input
          size="sm"
          inputMode="decimal"
          dir="ltr"
          className="h-6 scroll-mt-16 px-1.5 text-end tabular-nums"
          value={value}
          maxLength={32}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") {
              event.preventDefault();
              onChange(stepQuotationQuantity(value, 1));
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              onChange(stepQuotationQuantity(value, -1));
            }
          }}
        />
      </Field>
    );
  }

  return (
    <Field label={resolvedLabel} error={error} className={cn("w-36 lg:w-28", !error && "gap-0")}>
      <div
        className={cn(
          "inline-flex items-center overflow-hidden rounded-md border bg-card",
          error ? "border-destructive" : "border-input",
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-11 w-11 shrink-0 rounded-none px-0 lg:h-8 lg:w-8"
          aria-label={copy.decreaseQuantity}
          disabled={disabled}
          onClick={() => onChange(stepQuotationQuantity(value, -1))}
        >
          <Minus className="size-3.5" aria-hidden="true" />
        </Button>
        <Input
          size="sm"
          inputMode="decimal"
          dir="ltr"
          className="h-11 min-w-0 flex-1 scroll-mt-16 rounded-none border-0 bg-transparent px-1 text-center tabular-nums shadow-none focus-visible:ring-inset lg:h-8"
          value={value}
          maxLength={32}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-11 w-11 shrink-0 rounded-none px-0 lg:h-8 lg:w-8"
          aria-label={copy.increaseQuantity}
          disabled={disabled}
          onClick={() => onChange(stepQuotationQuantity(value, 1))}
        >
          <Plus className="size-3.5" aria-hidden="true" />
        </Button>
      </div>
    </Field>
  );
}
