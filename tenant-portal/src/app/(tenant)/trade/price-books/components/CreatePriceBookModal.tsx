"use client";

import { useState } from "react";
import { BookOpen, Lock, ShoppingBag, ShoppingCart } from "lucide-react";
import {
  Badge,
  Button,
  Field,
  FormModal,
  IdentifierText,
  Input,
  SWATCH_SURFACE_PALETTES,
  cn,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  COMMON_CURRENCY_PRESETS,
  EMPTY_PRICE_BOOK_FORM,
  PRICE_BOOK_CODE_MAX_LENGTH,
  PRICE_BOOK_PURPOSES,
  type PriceBookFormValues,
  type PriceBookPurpose,
} from "../pricing-contract";

interface CreatePriceBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: PriceBookFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

const PURPOSE_META: Record<
  PriceBookPurpose,
  { hue: "indigo" | "green"; Icon: typeof ShoppingCart }
> = {
  SALES: { hue: "indigo", Icon: ShoppingCart },
  PURCHASE: { hue: "green", Icon: ShoppingBag },
};

export function CreatePriceBookModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreatePriceBookModalProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<PriceBookFormValues>(EMPTY_PRICE_BOOK_FORM);
  const isDirty = JSON.stringify(values) !== JSON.stringify(EMPTY_PRICE_BOOK_FORM);

  const selectedPurposePalette = SWATCH_SURFACE_PALETTES[PURPOSE_META[values.purpose].hue];

  return (
    <FormModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_PRICE_BOOK_FORM);
          onClose();
        }
      }}
      size="wide"
      title={t.tradePricing.bookCreateTitle}
      description={t.tradePricing.bookCreateDescription}
      headerIcon={
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-lg border",
            selectedPurposePalette.iconBoxIdle,
          )}
        >
          <BookOpen className="size-4" aria-hidden="true" />
        </div>
      }
      titleBadge={
        <Badge tone="neutral">
          {tradeStatusLabel(t.tradeStatus, values.purpose, t.common.unknownCode)}
        </Badge>
      }
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      asideSlot={
        <div className="flex flex-col gap-3 p-4">
          <div className={cn("rounded-lg border p-3.5", selectedPurposePalette.sectionCard)}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                {t.tradePricing.livePreviewTitle}
              </span>
              <Badge tone="brand">{values.currencyCode.trim().toUpperCase() || "ISO"}</Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{t.tradePricing.livePreviewDesc}</p>
            <div className="mt-3 flex flex-col gap-2 rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{t.tradePricing.bookCode}</span>
                <IdentifierText className="text-xs font-semibold text-foreground">
                  {values.code.trim() || "PB-NEW-2026"}
                </IdentifierText>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{t.tradePricing.bookPurpose}</span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold",
                    selectedPurposePalette.badge,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", selectedPurposePalette.dot)} />
                  {tradeStatusLabel(t.tradeStatus, values.purpose, t.common.unknownCode)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{t.tradePricing.currencyCode}</span>
                <IdentifierText className="text-xs font-semibold text-foreground">
                  {values.currencyCode.trim().toUpperCase() || "SAR"}
                </IdentifierText>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3 text-xs",
              SWATCH_SURFACE_PALETTES.amber.sectionCard,
            )}
          >
            <Lock
              className={cn("mt-0.5 size-4 shrink-0", SWATCH_SURFACE_PALETTES.amber.iconText)}
              aria-hidden="true"
            />
            <span className="text-foreground">{t.tradePricing.immutableWarning}</span>
          </div>
        </div>
      }
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.tradePricing.bookCreateTitle,
        sectionInvalid: t.tradeCommon.actionFailed,
      }}
    >
      <div className="flex flex-col gap-4">
        <Field
          label={t.tradePricing.bookCode}
          hint={t.tradePricing.guideBookCode}
          showLabel
          hintPlacement="tooltip"
          required
        >
          <Input
            size="sm"
            dir="ltr"
            className="font-mono"
            placeholder="PB-KSA-WHOLESALE-2026"
            value={values.code}
            maxLength={PRICE_BOOK_CODE_MAX_LENGTH}
            disabled={isSubmitting}
            onChange={(event) => setValues((current) => ({ ...current, code: event.target.value }))}
          />
        </Field>

        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-foreground">
            {t.tradePricing.bookPurpose}
          </span>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {PRICE_BOOK_PURPOSES.map((purposeValue) => {
              const meta = PURPOSE_META[purposeValue];
              const palette = SWATCH_SURFACE_PALETTES[meta.hue];
              const Icon = meta.Icon;
              const isSelected = values.purpose === purposeValue;
              return (
                <Button
                  key={purposeValue}
                  type="button"
                  variant="ghost"
                  disabled={isSubmitting}
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      purpose: purposeValue,
                    }))
                  }
                  className={cn(
                    "h-auto flex-col items-start justify-start gap-2 rounded-lg border p-3.5 text-start whitespace-normal",
                    isSelected ? palette.tileActive : palette.tileIdle,
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg border",
                        isSelected ? palette.iconBoxActive : palette.iconBoxIdle,
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                    <IdentifierText className="text-xs font-semibold">
                      {purposeValue}
                    </IdentifierText>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-foreground">
                      {tradeStatusLabel(t.tradeStatus, purposeValue, t.common.unknownCode)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {purposeValue === "SALES"
                        ? t.tradePricing.purposeSalesDesc
                        : t.tradePricing.purposePurchaseDesc}
                    </span>
                  </div>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Field
            label={t.tradePricing.currencyCode}
            hint={t.tradePricing.guideCurrencyCode}
            showLabel
            hintPlacement="tooltip"
            required
          >
            <Input
              size="sm"
              dir="ltr"
              className="font-mono uppercase"
              placeholder="SAR"
              value={values.currencyCode}
              maxLength={3}
              disabled={isSubmitting}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  currencyCode: event.target.value.toUpperCase(),
                }))
              }
            />
          </Field>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {t.tradePricing.currencyPresetsLabel}:
            </span>
            {COMMON_CURRENCY_PRESETS.map((preset) => {
              const active = values.currencyCode.trim().toUpperCase() === preset;
              return (
                <Button
                  key={preset}
                  type="button"
                  size="xs"
                  variant={active ? "primary" : "outline"}
                  disabled={isSubmitting}
                  onClick={() =>
                    setValues((current) => ({
                      ...current,
                      currencyCode: preset,
                    }))
                  }
                >
                  <IdentifierText className="text-xs">{preset}</IdentifierText>
                </Button>
              );
            })}
          </div>
        </div>
      </div>
    </FormModal>
  );
}
