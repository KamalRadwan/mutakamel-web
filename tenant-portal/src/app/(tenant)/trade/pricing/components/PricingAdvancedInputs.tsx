"use client";

import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, cn } from "@/design-system";
import { formatTemplate } from "@/lib/format/template";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { localizedBookDisplayName } from "../../price-books/pricing-contract";
import type { usePricingWorkbench } from "../hooks/usePricingWorkbench";

const AUTO_BOOK_VALUE = "__AUTO_PRICE_BOOK__";

export function PricingAdvancedInputs({ workbench, disabled }: { workbench: ReturnType<typeof usePricingWorkbench>; disabled: boolean }) {
  const { t, lang, values, eligibleBooks, isAdvancedOpen, setIsAdvancedOpen, advancedSummaryText, setValue } = workbench;
  const purposeLabel = tradeStatusLabel(t.tradeStatus, values.purpose, t.common.unknownCode);
  return (
      <Collapsible
        open={isAdvancedOpen}
        onOpenChange={setIsAdvancedOpen}
        className="rounded-md border border-border bg-surface-subtle/50 px-3 py-2.5"
      >
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-2 text-xs font-medium text-foreground">
          <span>{t.tradePricing.evalAdvancedSettings}</span>
          <ChevronDown
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isAdvancedOpen && "rotate-180")}
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        {!isAdvancedOpen ? <p className="mt-1 truncate text-xs text-muted-foreground">{advancedSummaryText}</p> : null}
        <CollapsibleContent className="pt-3">
          <div className="flex flex-col gap-2.5">
            <Field label={t.tradePricing.pricingAtLabel} showLabel>
              <Input
                type="datetime-local"
                size="sm"
                dir="ltr"
                value={values.pricingAt ?? ""}
                disabled={disabled}
                onChange={(event) => setValue({ pricingAt: event.target.value })}
              />
            </Field>

            <Field
              label={t.tradePricing.evalPriceBookOverrideLabel}
              showLabel
              hint={
                eligibleBooks.length > 0
                  ? formatTemplate(t.tradePricing.evalPriceBookFilteredHint, {
                      purpose: purposeLabel,
                      currency: values.currencyCode.trim().toUpperCase() || "—",
                    })
                  : t.tradePricing.evalPriceBookNoEligible
              }
            >
              <Select
                value={values.priceBookId || AUTO_BOOK_VALUE}
                disabled={disabled}
                onValueChange={(next) => setValue({ priceBookId: next === AUTO_BOOK_VALUE ? "" : next })}
              >
                <SelectTrigger size="sm" aria-label={t.tradePricing.evalPriceBookOverrideLabel}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_BOOK_VALUE}>{t.tradePricing.selectPriceBookAuto}</SelectItem>
                  {eligibleBooks.map((book) => (
                    <SelectItem key={book.id} value={book.id}>
                      {localizedBookDisplayName(book, lang)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </CollapsibleContent>
      </Collapsible>
  );
}
