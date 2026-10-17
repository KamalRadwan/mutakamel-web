"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Calculator, Sparkles } from "lucide-react";
import { Badge, Button, Field, FormModal, IdentifierText, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { isUuidV7 } from "../../../trade-advanced-validation";
import {
  EMPTY_UOM_CONVERSION_FORM,
  suggestIntegerFraction,
  type UomConversionFormValues,
} from "../../inventory-governance-contract";

interface CreateUomConversionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (values: UomConversionFormValues) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

const RATIO_PRESETS: ReadonlyArray<{ num: string; den: string; labelEn: string; labelAr: string }> = [
  { num: "12", den: "1", labelEn: "12 : 1 (Dozen / Box)", labelAr: "12 : 1 (دستة / صندوق)" },
  { num: "24", den: "1", labelEn: "24 : 1 (Case)", labelAr: "24 : 1 (كرتون)" },
  { num: "100", den: "1", labelEn: "100 : 1 (Pack)", labelAr: "100 : 1 (عبوة)" },
  { num: "1000", den: "1", labelEn: "1000 : 1 (Metric)", labelAr: "1000 : 1 (ألف)" },
  { num: "3", den: "2", labelEn: "3 : 2 (1.5× Ratio)", labelAr: "3 : 2 (نسبة 1.5)" },
];

export function CreateUomConversionModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateUomConversionModalProps) {
  const { t, lang } = useI18n();
  const isAr = lang === "ar";
  const [values, setValues] = useState<UomConversionFormValues>(
    EMPTY_UOM_CONVERSION_FORM,
  );
  const isDirty =
    JSON.stringify(values) !== JSON.stringify(EMPTY_UOM_CONVERSION_FORM);
  const set = (patch: Partial<UomConversionFormValues>) =>
    setValues((current) => ({ ...current, ...patch }));

  const numText = values.factorNumerator.trim() || "1";
  const denText = values.factorDenominator.trim() || "1";
  const fromLabel = values.fromUomId.trim().slice(0, 8) || "FROM_UOM";
  const toLabel = values.toUomId.trim().slice(0, 8) || "TO_UOM";

  const sameUomConflict =
    values.fromUomId.trim().length > 0 &&
    values.fromUomId.trim().toLowerCase() === values.toUomId.trim().toLowerCase();

  const fractionSuggestion = useMemo(() => {
    if (values.factorNumerator.includes(".")) {
      return suggestIntegerFraction(values.factorNumerator);
    }
    if (values.factorDenominator.includes(".")) {
      return suggestIntegerFraction(values.factorDenominator);
    }
    return null;
  }, [values.factorNumerator, values.factorDenominator]);

  const isReady =
    isUuidV7(values.itemCompanyProfileId) &&
    isUuidV7(values.fromUomId) &&
    isUuidV7(values.toUomId) &&
    !sameUomConflict &&
    /^[1-9]\d*$/.test(values.factorNumerator.trim()) &&
    /^[1-9]\d*$/.test(values.factorDenominator.trim()) &&
    values.effectiveFrom.trim().length > 0;

  return (
    <FormModal
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          setValues(EMPTY_UOM_CONVERSION_FORM);
          onClose();
        }
      }}
      size="wide"
      title={t.tradeInventory.conversionCreateTitle}
      description={t.tradeInventory.conversionCreateDescription}
      headerAside={
        <Badge tone={isReady ? "positive" : "caution"}>
          {isReady
            ? isAr
              ? "مسودة جاهزة للحفظ (DRAFT)"
              : "Ready to Create (DRAFT)"
            : isAr
              ? "أكمل المعادلة الكسرية"
              : "Complete Rational Formula"}
        </Badge>
      }
      isDirty={isDirty}
      isSubmitting={isSubmitting}
      onSubmit={() => void onSubmit(values)}
      error={error ?? undefined}
      labels={{
        submit: t.common.save,
        cancel: t.common.cancel,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: t.common.status,
        sectionInvalid: t.common.cancel,
      }}
    >
      <div className="flex flex-col gap-4">
        {/* Live Conversion Formula Preview Card */}
        <div className="grid gap-2 rounded-lg border border-info/30 bg-info-subtle/40 p-3.5">
          <div className="flex items-center justify-between gap-2 text-xs font-semibold text-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Calculator className="size-4 text-info-subtle-foreground" aria-hidden="true" />
              <span>{t.trade.conversionFormulaPreview}</span>
            </span>
            <Badge tone="brand">
              bigint Numerator / Denominator
            </Badge>
          </div>
          <div
            dir="ltr"
            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-semibold tabular-nums text-foreground shadow-xs"
          >
            <span>1</span>
            <IdentifierText className="rounded-md bg-muted px-2 py-0.5 text-xs">
              {fromLabel}
            </IdentifierText>
            <span className="text-muted-foreground">=</span>
            <IdentifierText className="rounded-md bg-info-subtle px-2.5 py-0.5 text-xs text-info-subtle-foreground">
              {numText} / {denText}
            </IdentifierText>
            <IdentifierText className="rounded-md bg-muted px-2 py-0.5 text-xs">
              {toLabel}
            </IdentifierText>
          </div>
          <span className="text-2xs text-muted-foreground">
            {t.trade.conversionFormulaHint}
          </span>
        </div>

        {/* Same-UOM Conflict Guard */}
        {sameUomConflict ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-danger/40 bg-danger-subtle/30 p-3 text-xs text-danger-subtle-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">
                {isAr
                  ? "لا يمكن التحويل بين نفس وحدة القياس (SAME_UOM)"
                  : "Source and Target UOM cannot be identical (SAME_UOM)"}
              </span>
              <span className="text-2xs opacity-90">
                {t.tradeInventory.fromUom} ≠ {t.tradeInventory.toUom}
              </span>
            </div>
          </div>
        ) : null}

        {/* Decimal-to-Rational Helper */}
        {fractionSuggestion ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning-subtle/30 p-3 text-xs text-warning-subtle-foreground">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 shrink-0" aria-hidden="true" />
              <span>
                {isAr
                  ? `الكسور العشرية غير مقبولة في حقول bigint. هل تقصد النسبة الصحيحة ${fractionSuggestion.numerator} : ${fractionSuggestion.denominator}؟`
                  : `Decimals are rejected by bigint fields. Convert to exact integer ratio ${fractionSuggestion.numerator} : ${fractionSuggestion.denominator}?`}
              </span>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                set({
                  factorNumerator: fractionSuggestion.numerator,
                  factorDenominator: fractionSuggestion.denominator,
                })
              }
              className="h-auto rounded-md border border-warning/40 bg-card px-2.5 py-1 text-2xs font-semibold text-foreground shadow-2xs transition-colors hover:bg-accent"
            >
              {isAr
                ? `تطبيق ${fractionSuggestion.numerator} / ${fractionSuggestion.denominator}`
                : `Apply ${fractionSuggestion.numerator} / ${fractionSuggestion.denominator}`}
            </Button>
          </div>
        ) : null}

        <Field label={t.tradeInventory.itemCompanyProfileId} required>
          <Input
            size="sm"
            value={values.itemCompanyProfileId}
            disabled={isSubmitting}
            placeholder={t.tradeInventory.uuidPlaceholder}
            onChange={(event) =>
              set({ itemCompanyProfileId: event.target.value })
            }
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t.tradeInventory.fromUom} required>
            <Input
              size="sm"
              value={values.fromUomId}
              disabled={isSubmitting}
              placeholder={t.tradeInventory.uuidPlaceholder}
              onChange={(event) => set({ fromUomId: event.target.value })}
            />
          </Field>
          <Field label={t.tradeInventory.toUom} required>
            <Input
              size="sm"
              value={values.toUomId}
              disabled={isSubmitting}
              placeholder={t.tradeInventory.uuidPlaceholder}
              onChange={(event) => set({ toUomId: event.target.value })}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field
            label={t.tradeInventory.factorNumerator}
            required
            hint={t.tradeInventory.factorIntegerHint}
          >
            <Input
              size="sm"
              placeholder="12"
              value={values.factorNumerator}
              disabled={isSubmitting}
              inputMode="numeric"
              onChange={(event) => set({ factorNumerator: event.target.value })}
            />
          </Field>
          <Field
            label={t.tradeInventory.factorDenominator}
            required
            hint={t.tradeInventory.factorIntegerHint}
          >
            <Input
              size="sm"
              placeholder="1"
              value={values.factorDenominator}
              disabled={isSubmitting}
              inputMode="numeric"
              onChange={(event) => set({ factorDenominator: event.target.value })}
            />
          </Field>
        </div>

        {/* Common Ratio Presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-2xs font-medium text-muted-foreground">
            {isAr ? "نسب قياسية سريعة:" : "Quick Ratio Presets:"}
          </span>
          {RATIO_PRESETS.map((preset) => {
            const active =
              values.factorNumerator.trim() === preset.num &&
              values.factorDenominator.trim() === preset.den;
            return (
              <Button
                key={`${preset.num}:${preset.den}`}
                type="button"
                variant="ghost"
                size="sm"
                disabled={isSubmitting}
                onClick={() =>
                  set({ factorNumerator: preset.num, factorDenominator: preset.den })
                }
                className={`h-auto rounded-md border px-2 py-0.5 font-mono text-2xs transition-colors ${
                  active
                    ? "border-primary bg-primary/10 font-semibold text-primary"
                    : "border-border bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {isAr ? preset.labelAr : preset.labelEn}
              </Button>
            );
          })}
        </div>

        <Field label={t.tradeInventory.effectiveFrom} required>
          <Input
            size="sm"
            placeholder={t.tradeInventory.effectiveFrom}
            type="datetime-local"
            value={values.effectiveFrom}
            disabled={isSubmitting}
            onChange={(event) => set({ effectiveFrom: event.target.value })}
          />
        </Field>
      </div>
    </FormModal>
  );
}

