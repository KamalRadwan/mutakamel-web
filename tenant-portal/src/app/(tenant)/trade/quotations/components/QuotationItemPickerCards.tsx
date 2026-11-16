"use client";

import {
  Badge,
  Button,
  Checkbox,
  Field,
  IdentifierText,
  Input,
  Money,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { multiplyFixedDecimal } from "../../documents/fixed-decimal";
import type { TradeLineDraftState } from "../../documents/hooks/useTradeLineDraft";
import { canonicalTradeQuantity } from "../../documents/trade-line-validation";
import {
  itemDescriptionPreview,
  itemDisplayName,
  type TradeItemOption,
} from "../../documents/trade-lookup-contract";
import type { QuotationItemPickerState } from "../hooks/useQuotationItemPicker";
import { QuotationItemThumbnail } from "./QuotationItemIdentity";

export function resolvePickerItemRow(
  item: TradeItemOption,
  lang: "en" | "ar",
  picker: QuotationItemPickerState,
  draft: TradeLineDraftState,
) {
  const index = picker.rows.findIndex((candidate) => candidate.itemId === item.id);
  const row = picker.rows[index];
  const price = index >= 0 ? picker.pricing.prices[index] : undefined;
  const quantity = row ? canonicalTradeQuantity(row.quantity) : null;
  const itemUoms = draft.uomsByItem[item.id];
  const hasNoUnits = Array.isArray(itemUoms) && itemUoms.length === 0;
  const name = itemDisplayName(item, lang);
  const description = itemDescriptionPreview(item, lang, "SALES");
  const hasValidPrice = Boolean(price?.unitPrice);
  return { row, price, quantity, itemUoms, hasNoUnits, name, description, hasValidPrice };
}


export function QuotationPickerDescription({
  description,
  label,
  dir,
  mobile = false,
}: {
  description: string;
  label: string;
  dir: "ltr" | "rtl";
  mobile?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          aria-label={`${label}: ${description}`}
          className={cn(
            "h-auto max-w-full justify-start rounded-sm px-1 py-0.5 text-start font-normal text-muted-foreground hover:text-foreground scroll-mt-12",
            mobile ? "min-h-11 whitespace-normal py-1 text-xs" : "text-sm",
          )}
        >
          <span className={cn(mobile ? "line-clamp-2 wrap-anywhere" : "truncate")}>{description}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        dir={dir}
        align="start"
        className="max-h-56 w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain p-3 text-xs leading-relaxed text-foreground whitespace-pre-wrap wrap-anywhere"
      >
        {description}
      </PopoverContent>
    </Popover>
  );
}

export function QuotationPickerUnitPrice({
  state,
  currencyCode,
}: {
  state: ReturnType<typeof resolvePickerItemRow>;
  currencyCode: string;
}) {
  const { t } = useI18n();
  const copy = t.quotationExperience;
  if (state.hasValidPrice) {
    return <Money value={state.price!.unitPrice!} currency={currencyCode} maximumFractionDigits={8} />;
  }
  if (state.price?.isPricing) {
    return <span className="text-xs text-muted-foreground">{copy.pricePending}</span>;
  }
  if (state.row?.uomId && state.quantity !== null) {
    return <span className="text-xs text-muted-foreground">{copy.priceUnavailable}</span>;
  }
  return <span className="text-muted-foreground">—</span>;
}

export function QuotationPickerLineAmount({
  state,
  currencyCode,
}: {
  state: ReturnType<typeof resolvePickerItemRow>;
  currencyCode: string;
}) {
  if (state.hasValidPrice && state.quantity !== null) {
    return (
      <Money
        value={multiplyFixedDecimal(state.quantity, state.price!.unitPrice!)}
        currency={currencyCode}
        maximumFractionDigits={8}
      />
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

export function QuotationItemPickerCards({
  items,
  draft,
  picker,
  currencyCode,
}: {
  items: TradeItemOption[];
  draft: TradeLineDraftState;
  picker: QuotationItemPickerState;
  currencyCode: string;
}) {
  const { t, lang, dir } = useI18n();
  const copy = t.quotationExperience;
  const descriptionLabel = t.coreOperations.templates.description;

  return (
    <div className="space-y-2.5 p-1 lg:hidden">
      {items.map((item) => {
        const state = resolvePickerItemRow(item, lang, picker, draft);
        return (
          <div
            key={item.id}
            className={cn(
              "space-y-2.5 rounded-lg border p-2.5",
              state.row ? "border-primary/25 bg-primary/5" : "border-border bg-card",
            )}
          >
            <div className="flex items-center gap-2.5">
              <Checkbox
                checked={Boolean(state.row)}
                className="ds-hit-target shrink-0"
                aria-label={`${copy.addItems}: ${state.name}`}
                onCheckedChange={() => picker.toggle(item.id)}
              />
              <QuotationItemThumbnail item={item} />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">{state.name}</span>
                <Badge tone="brand" size="sm" className="shrink-0 font-normal">
                  <IdentifierText>{item.canonicalCode}</IdentifierText>
                </Badge>
              </div>
            </div>

            <div className="min-w-0 space-y-0.5 ps-6">
              <p className="text-xs text-muted-foreground">{descriptionLabel}</p>
              <QuotationPickerDescription
                description={state.description}
                label={descriptionLabel}
                dir={dir}
                mobile
              />
            </div>

            {state.row ? (
              <>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  <Field
                    label={`${copy.unit}: ${state.name}`}
                    showLabel
                    error={state.hasNoUnits ? copy.noUnits : undefined}
                    className="min-w-0"
                  >
                    <Select
                      dir={dir}
                      value={state.row.uomId || undefined}
                      onValueChange={(uomId) => picker.update(item.id, { uomId })}
                    >
                      <SelectTrigger size="md" className="ds-hit-area">
                        <SelectValue placeholder={copy.selectUnit} />
                      </SelectTrigger>
                      <SelectContent>
                        {(state.itemUoms ?? []).map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label={`${copy.quantity}: ${state.name}`}
                    showLabel
                    error={state.quantity === null ? copy.quantityInvalid : undefined}
                    className="min-w-0"
                  >
                    <Input
                      size="md"
                      inputMode="decimal"
                      dir="ltr"
                      maxLength={32}
                      value={state.row.quantity}
                      onChange={(event) => picker.update(item.id, { quantity: event.target.value })}
                      className="ds-hit-area text-end tabular-nums"
                    />
                  </Field>
                </div>
                <dl className="flex flex-wrap items-end justify-between gap-3 border-t border-primary/10 pt-2 text-sm">
                  <div className="space-y-0.5">
                    <dt className="text-xs text-muted-foreground">{copy.unitPrice}</dt>
                    <dd className="font-normal">
                      <QuotationPickerUnitPrice
                        state={state}
                        currencyCode={currencyCode}
                      />
                    </dd>
                  </div>
                  <div className="space-y-0.5 text-end">
                    <dt className="text-xs text-muted-foreground">{copy.lineAmount}</dt>
                    <dd className="font-normal">
                      <QuotationPickerLineAmount state={state} currencyCode={currencyCode} />
                    </dd>
                  </div>
                </dl>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
