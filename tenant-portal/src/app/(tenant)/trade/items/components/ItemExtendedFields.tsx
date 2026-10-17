"use client";

import { useState } from "react";
import { Barcode, ChevronDown, FileText, User } from "lucide-react";
import {
  Badge,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Combobox,
  DegradedBanner,
  Field,
  IdentifierText,
  Input,
  SWATCH_SURFACE_PALETTES,
  Textarea,
  TooltipProvider,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  formatTradeDecimal,
  isItemDecimalString,
  ITEM_BARCODE_MAX_LENGTH,
  ITEM_DESCRIPTION_MAX_LENGTH,
  ITEM_NOTES_MAX_LENGTH,
  type ItemFormValues,
} from "../item-contract";
import { useItemReferenceData } from "../hooks/useItemReferenceData";

interface ItemExtendedFieldsProps {
  values: ItemFormValues;
  disabled: boolean;
  enabled?: boolean;
  errors?: {
    barcode?: string;
    notes?: string;
    ownerUserId?: string;
    weightKg?: string;
    volumeM3?: string;
    descriptions?: string;
  };
  onChange: (patch: Partial<ItemFormValues>) => void;
}

export function ItemExtendedFields({
  values,
  disabled,
  enabled = true,
  errors = {},
  onChange,
}: ItemExtendedFieldsProps) {
  const { t } = useI18n();
  const reference = useItemReferenceData(enabled);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [descriptionsOpen, setDescriptionsOpen] = useState(false);

  const isService = values.itemKind === "SERVICE";

  const detailsHaveErrors = Boolean(
    errors.barcode ||
      errors.notes ||
      errors.ownerUserId ||
      errors.weightKg ||
      errors.volumeM3,
  );
  const detailsExpanded = detailsOpen || detailsHaveErrors;
  const descriptionsExpanded = descriptionsOpen || Boolean(errors.descriptions);

  const ownerMissing =
    values.ownerUserId &&
    !reference.owners.some((owner) => owner.id === values.ownerUserId);
  const selectedOwner = reference.owners.find(
    (owner) => owner.id === values.ownerUserId,
  );

  const populatedDetailsCount = [
    values.barcode.trim(),
    values.ownerUserId.trim(),
    values.weightKg.trim(),
    values.volumeM3.trim(),
    values.notes.trim(),
  ].filter(Boolean).length;

  const filledDescriptionsCount = [
    values.quotationDescription.trim(),
    values.salesOrderDescription.trim(),
    values.receiptDescription.trim(),
    values.deliveryOrderDescription.trim(),
  ].filter(Boolean).length;

  return (
    <TooltipProvider>
      <div className="grid gap-3.5">
        {/* 1. Operational and Physical Details */}
        <Collapsible
          open={detailsExpanded}
          onOpenChange={setDetailsOpen}
          className={cn(
            "overflow-hidden rounded-lg border bg-card shadow-2xs",
            detailsHaveErrors ? "border-destructive/50" : "border-border",
          )}
        >
          <CollapsibleTrigger className="min-h-11 w-full justify-between rounded-none bg-muted/25 px-4 py-2.5 text-start hover:bg-muted/45">
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md border",
                  detailsHaveErrors
                    ? SWATCH_SURFACE_PALETTES.red.iconBoxIdle
                    : SWATCH_SURFACE_PALETTES.teal.iconBoxIdle,
                )}
              >
                <Barcode className="size-3.5" aria-hidden="true" />
              </span>
              <span className="truncate text-sm font-semibold text-foreground">
                {t.trade.itemOperationalDetails}
              </span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                {t.trade.itemOperationalDetailsSubtitle}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {detailsHaveErrors ? (
                <Badge tone="negative">{t.trade.itemFormHasErrors}</Badge>
              ) : populatedDetailsCount > 0 ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold",
                    SWATCH_SURFACE_PALETTES.teal.badge,
                  )}
                >
                  <IdentifierText>{String(populatedDetailsCount)}</IdentifierText>
                </span>
              ) : (
                <Badge tone="neutral">{t.trade.itemOptional}</Badge>
              )}
              <ChevronDown
                className={
                  detailsExpanded
                    ? "size-4 rotate-180 text-muted-foreground transition-transform"
                    : "size-4 text-muted-foreground transition-transform"
                }
                aria-hidden="true"
              />
            </span>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="grid gap-3.5 border-t border-border p-4">
              <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4 sm:items-start">
                <Field label={t.trade.itemBarcode} showLabel error={errors.barcode}>
                  <Input
                    size="md"
                    dir="ltr"
                    className="font-mono"
                    value={values.barcode}
                    onChange={(event) => onChange({ barcode: event.target.value })}
                    maxLength={ITEM_BARCODE_MAX_LENGTH}
                    disabled={disabled}
                  />
                </Field>

                <Field label={t.trade.itemOwner} showLabel error={errors.ownerUserId}>
                  <Combobox
                    value={values.ownerUserId || undefined}
                    selectedLabel={
                      selectedOwner?.name ??
                      (ownerMissing ? values.ownerUserId : undefined)
                    }
                    leadingSlot={
                      selectedOwner ? (
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border text-2xs font-semibold",
                            SWATCH_SURFACE_PALETTES.teal.iconBoxIdle,
                          )}
                          aria-hidden="true"
                        >
                          <User className="size-3" />
                        </span>
                      ) : undefined
                    }
                    onValueChange={(next) => onChange({ ownerUserId: next ?? "" })}
                    options={reference.owners.map((owner) => ({
                      value: owner.id,
                      label: owner.name,
                    }))}
                    onSearch={reference.search}
                    loading={reference.isLoading}
                    disabled={disabled}
                    size="md"
                    placeholder={t.trade.itemOwnerPlaceholder}
                    searchPlaceholder={t.trade.itemSearchOwners}
                    loadingLabel={t.common.loading}
                    emptyLabel={t.trade.itemNoOwnerResults}
                    clearLabel={t.trade.itemNoOwner}
                  />
                </Field>

                <Field
                  label={t.trade.itemWeightKg}
                  showLabel
                  hint={
                    isService
                      ? t.trade.itemServiceWeightVolumeDisabledHint
                      : t.trade.itemPositiveDecimal
                  }
                  hintPlacement="tooltip"
                  error={errors.weightKg}
                >
                  <div className="relative flex items-center">
                    <Input
                      size="md"
                      dir="ltr"
                      placeholder={isService ? "—" : "0.00"}
                      inputMode="decimal"
                      className="pe-10 font-mono tabular-nums"
                      value={values.weightKg}
                      onChange={(event) => onChange({ weightKg: event.target.value })}
                      onBlur={() => {
                        if (values.weightKg.trim() && isItemDecimalString(values.weightKg.trim())) {
                          onChange({ weightKg: formatTradeDecimal(values.weightKg) });
                        }
                      }}
                      disabled={disabled || isService}
                    />
                    <span
                      className="pointer-events-none absolute end-2.5 text-2xs font-semibold text-muted-foreground"
                      aria-hidden="true"
                    >
                      {t.trade.itemUnitKgSuffix}
                    </span>
                  </div>
                </Field>

                <Field
                  label={t.trade.itemVolumeM3}
                  showLabel
                  hint={
                    isService
                      ? t.trade.itemServiceWeightVolumeDisabledHint
                      : t.trade.itemPositiveDecimal
                  }
                  hintPlacement="tooltip"
                  error={errors.volumeM3}
                >
                  <div className="relative flex items-center">
                    <Input
                      size="md"
                      dir="ltr"
                      placeholder={isService ? "—" : "0.00"}
                      inputMode="decimal"
                      className="pe-10 font-mono tabular-nums"
                      value={values.volumeM3}
                      onChange={(event) => onChange({ volumeM3: event.target.value })}
                      onBlur={() => {
                        if (values.volumeM3.trim() && isItemDecimalString(values.volumeM3.trim())) {
                          onChange({ volumeM3: formatTradeDecimal(values.volumeM3) });
                        }
                      }}
                      disabled={disabled || isService}
                    />
                    <span
                      className="pointer-events-none absolute end-2.5 text-2xs font-semibold text-muted-foreground"
                      aria-hidden="true"
                    >
                      {t.trade.itemUnitM3Suffix}
                    </span>
                  </div>
                </Field>
              </div>

              {isService ? (
                <p className="text-xs text-muted-foreground">
                  {t.trade.itemServiceWeightVolumeDisabledHint}
                </p>
              ) : null}

              <div className="relative flex flex-col gap-1.5">
                <span
                  className="end-0 top-0 text-2xs text-muted-foreground sm:absolute"
                  aria-hidden="true"
                >
                  <IdentifierText>{`${values.notes.length} / ${ITEM_NOTES_MAX_LENGTH}`}</IdentifierText>
                </span>
                <Field label={t.trade.itemNotes} showLabel error={errors.notes}>
                  <Textarea
                    rows={2}
                    value={values.notes}
                    onChange={(event) => onChange({ notes: event.target.value })}
                    maxLength={ITEM_NOTES_MAX_LENGTH}
                    disabled={disabled}
                  />
                </Field>
              </div>

              {reference.error ? (
                <DegradedBanner message={t.trade.itemReferenceDataUnavailable} />
              ) : null}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* 2. Default Document Descriptions (4 Snapshot Textareas) */}
        <Collapsible
          open={descriptionsExpanded}
          onOpenChange={setDescriptionsOpen}
          className={cn(
            "overflow-hidden rounded-lg border bg-card shadow-2xs",
            errors.descriptions ? "border-destructive/50" : "border-border",
          )}
        >
          <CollapsibleTrigger className="min-h-11 w-full justify-between rounded-none bg-muted/25 px-4 py-2.5 text-start hover:bg-muted/45">
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-md border",
                  errors.descriptions
                    ? SWATCH_SURFACE_PALETTES.red.iconBoxIdle
                    : SWATCH_SURFACE_PALETTES.amber.iconBoxIdle,
                )}
              >
                <FileText className="size-3.5" aria-hidden="true" />
              </span>
              <span className="truncate text-sm font-semibold text-foreground">
                {t.trade.itemDocumentDescriptions}
              </span>
              <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                {t.trade.itemDocumentDescriptionsHint}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {filledDescriptionsCount > 0 ? (
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold",
                    SWATCH_SURFACE_PALETTES.amber.badge,
                  )}
                >
                  <IdentifierText>{`${filledDescriptionsCount} / 4`}</IdentifierText>
                </span>
              ) : (
                <Badge tone="neutral">{t.trade.itemOptional}</Badge>
              )}
              <ChevronDown
                className={
                  descriptionsExpanded
                    ? "size-4 rotate-180 text-muted-foreground transition-transform"
                    : "size-4 text-muted-foreground transition-transform"
                }
                aria-hidden="true"
              />
            </span>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="grid gap-3.5 border-t border-border p-4">
              <p className="text-xs text-muted-foreground">
                {t.trade.itemDocumentDescriptionsHint}
              </p>
              <div className="grid gap-3.5 sm:grid-cols-2 sm:items-start">
                <DescriptionField
                  label={t.trade.itemQuotationDescription}
                  value={values.quotationDescription}
                  error={errors.descriptions}
                  disabled={disabled}
                  onChange={(quotationDescription) =>
                    onChange({ quotationDescription })
                  }
                />
                <DescriptionField
                  label={t.trade.itemSalesOrderDescription}
                  value={values.salesOrderDescription}
                  disabled={disabled}
                  onChange={(salesOrderDescription) =>
                    onChange({ salesOrderDescription })
                  }
                />
                <DescriptionField
                  label={t.trade.itemReceiptDescription}
                  value={values.receiptDescription}
                  disabled={disabled}
                  onChange={(receiptDescription) =>
                    onChange({ receiptDescription })
                  }
                />
                <DescriptionField
                  label={t.trade.itemDeliveryDescription}
                  value={values.deliveryOrderDescription}
                  disabled={disabled}
                  onChange={(deliveryOrderDescription) =>
                    onChange({ deliveryOrderDescription })
                  }
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </TooltipProvider>
  );
}

function DescriptionField({
  label,
  value,
  error,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  error?: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const nearLimit = value.length >= ITEM_DESCRIPTION_MAX_LENGTH - 50;
  return (
    <div className="relative flex flex-col gap-1.5">
      <span
        className={cn(
          "end-0 top-0 text-2xs sm:absolute",
          nearLimit ? "font-semibold text-warning-subtle-foreground" : "text-muted-foreground",
        )}
        aria-hidden="true"
      >
        <IdentifierText>{`${value.length} / ${ITEM_DESCRIPTION_MAX_LENGTH}`}</IdentifierText>
      </span>
      <Field label={label} showLabel error={error}>
        <Textarea
          rows={2}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={ITEM_DESCRIPTION_MAX_LENGTH}
          disabled={disabled}
        />
      </Field>
    </div>
  );
}
