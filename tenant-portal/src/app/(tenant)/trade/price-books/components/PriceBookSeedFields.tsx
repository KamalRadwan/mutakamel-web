"use client";

import type { Dispatch, SetStateAction } from "react";
import { BookOpen, Check, Copy, Sparkles } from "lucide-react";
import { Button, Field, Input, SWATCH_SURFACE_PALETTES, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, cn } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { PRICE_ADJUSTMENT_MODES, PRICE_ROUNDING_MODES, localizedBookDisplayName, type PriceAdjustmentMode, type PriceBook, type PriceBookFormValues, type PriceRoundingMode } from "../pricing-contract";

interface PriceBookSeedFieldsProps {
  values: PriceBookFormValues;
  setValues: Dispatch<SetStateAction<PriceBookFormValues>>;
  compatibleSourceBooks: PriceBook[];
  selectedSourceBook: PriceBook | undefined;
  isSubmitting: boolean;
}

export function PriceBookSeedFields({ values, setValues, compatibleSourceBooks, selectedSourceBook, isSubmitting }: PriceBookSeedFieldsProps) {
  const { t, lang } = useI18n();
  const seedModes: ReadonlyArray<{
    id: NonNullable<PriceBookFormValues["seedMode"]>;
    title: string;
    desc: string;
    Icon: typeof BookOpen;
  }> = [
    {
      id: "CLONE",
      title: t.tradePricing.seedModeClone,
      desc: t.tradePricing.seedModeCloneDesc,
      Icon: Copy,
    },
    {
      id: "CATALOG",
      title: t.tradePricing.seedModeCatalog,
      desc: t.tradePricing.seedModeCatalogDesc,
      Icon: Sparkles,
    },
    {
      id: "EMPTY",
      title: t.tradePricing.seedModeEmpty,
      desc: t.tradePricing.seedModeEmptyDesc,
      Icon: BookOpen,
    },
  ];

  const adjustmentLabel = (mode: PriceAdjustmentMode): string => {
    switch (mode) {
      case "NONE":
        return t.tradePricing.adjustmentNone;
      case "PERCENTAGE":
        return t.tradePricing.adjustmentPercentage;
      case "FIXED_DELTA":
        return t.tradePricing.adjustmentFixed;
    }
  };

  const roundingLabel = (mode: PriceRoundingMode): string => {
    switch (mode) {
      case "NONE":
        return t.tradePricing.roundingNone;
      case "NEAREST_1":
        return t.tradePricing.roundingNearest1;
      case "NEAREST_0_50":
        return t.tradePricing.roundingNearest050;
      case "END_95":
        return t.tradePricing.roundingEnd95;
    }
  };

  return (
        <div className="flex flex-col gap-3 rounded-card border border-line-card bg-surface-subtle p-3.5">
          <span className="text-xs font-semibold text-foreground">
            {t.tradePricing.seedModeLabel}
          </span>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {seedModes.map((mode) => {
              const Icon = mode.Icon;
              const selected = (values.seedMode ?? "EMPTY") === mode.id;
              return (
                <Button
                  key={mode.id}
                  type="button"
                  variant="ghost"
                  disabled={isSubmitting}
                  onClick={() =>
                    setValues((curr) => ({
                      ...curr,
                      seedMode: mode.id,
                    }))
                  }
                  className={cn(
                    "h-auto flex-col items-start justify-start gap-1.5 rounded-card border p-3 text-start whitespace-normal",
                    selected
                      ? SWATCH_SURFACE_PALETTES.blue.tileActive
                      : "border-line-card bg-card text-foreground not-disabled:hover:bg-accent/40",
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-1.5">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Icon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                      {mode.title}
                    </span>
                    {selected ? (
                      <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    ) : null}
                  </div>
                  <span className="text-caption text-muted-foreground">{mode.desc}</span>
                </Button>
              );
            })}
          </div>

          {values.seedMode === "CLONE" || values.seedMode === "CATALOG" ? (
            <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-3">
              {values.seedMode === "CLONE" ? (
                <Field label={t.tradePricing.sourceBookLabel} showLabel required>
                  <Select
                    value={values.sourceBookId || selectedSourceBook?.id || ""}
                    disabled={isSubmitting || compatibleSourceBooks.length === 0}
                    onValueChange={(bookId) => {
                      const found = compatibleSourceBooks.find((b) => b.id === bookId);
                      setValues((curr) => ({
                        ...curr,
                        sourceBookId: bookId,
                        sourceVersionId: found?.versions[0]?.id ?? "",
                      }));
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={t.tradePricing.sourceBookLabel}
                      className="bg-card"
                    >
                      <SelectValue placeholder={t.tradePricing.sourceBookLabel} />
                    </SelectTrigger>
                    <SelectContent>
                      {compatibleSourceBooks.map((b) => {
                        const topVer = b.versions[0];
                        return (
                          <SelectItem key={b.id} value={b.id}>
                            {`${b.code} · ${topVer ? `v${topVer.versionNumber}` : localizedBookDisplayName(b, lang)}`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </Field>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-foreground">
                  {t.tradePricing.adjustmentModeLabel}
                </span>
                <div className="flex items-center gap-1.5">
                  <Select
                    value={values.adjustmentMode ?? "NONE"}
                    disabled={isSubmitting}
                    onValueChange={(next) =>
                      setValues((curr) => ({
                        ...curr,
                        adjustmentMode: next as PriceAdjustmentMode,
                      }))
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={t.tradePricing.adjustmentModeLabel}
                      className="flex-1 bg-card"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRICE_ADJUSTMENT_MODES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {adjustmentLabel(m)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    size="sm"
                    dir="ltr"
                    aria-label={t.tradePricing.adjustmentValueLabel}
                    className="w-20 bg-card font-mono tabular-nums"
                    placeholder="0"
                    value={values.adjustmentValue ?? "0"}
                    disabled={isSubmitting || (values.adjustmentMode ?? "NONE") === "NONE"}
                    onChange={(e) =>
                      setValues((curr) => ({ ...curr, adjustmentValue: e.target.value }))
                    }
                  />
                </div>
              </div>

              <Field label={t.tradePricing.roundingModeLabel} showLabel>
                <Select
                  value={values.roundingMode ?? "NONE"}
                  disabled={isSubmitting}
                  onValueChange={(next) =>
                    setValues((curr) => ({
                      ...curr,
                      roundingMode: next as PriceRoundingMode,
                    }))
                  }
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={t.tradePricing.roundingModeLabel}
                    className="bg-card"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRICE_ROUNDING_MODES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roundingLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {values.seedMode === "CLONE" ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border border-line-card bg-card px-3 py-2 sm:col-span-3">
                  <span className="text-xs font-semibold text-foreground">
                    {t.tradePricing.copyPromotionsLabel}
                  </span>
                  <Switch
                    aria-label={t.tradePricing.copyPromotionsLabel}
                    checked={values.copyPromotions ?? true}
                    disabled={isSubmitting}
                    onCheckedChange={(checked) =>
                      setValues((curr) => ({ ...curr, copyPromotions: checked }))
                    }
                  />
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
  );
}
