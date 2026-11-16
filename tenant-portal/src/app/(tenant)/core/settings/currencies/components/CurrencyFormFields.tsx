"use client";

import { useId, useMemo } from "react";
import { AlertTriangle, Lock } from "lucide-react";
import {
  Checkbox, Field, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  TooltipProvider, cn, focusRing,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import {
  CURRENCY_CODE_LENGTH, CURRENCY_NAME_MAX_LENGTH, CURRENCY_SYMBOL_MAX_LENGTH,
  hasValidSavedExchangeRate, isValidTypedExchangeRate, type CurrencyFormValues,
} from "../currency-contract";
import { deriveCurrencyMinorUnits, supportedSpendableCurrencyCodes } from "../iso4217-minor-units";
import {
  isCurrencyRateRequired, resolveCreateCurrencyBaseMode,
  type CurrencyErrorSummaryItem, type CurrencyFieldErrors, type CurrencyFieldName,
} from "../hooks/currency-form-validation";
import type { BaseCurrencyStatus } from "../hooks/useBaseCurrency";
import type { CurrencyFieldRefs } from "../hooks/useCurrencyForm";

interface CurrencyFormFieldsProps {
  values: CurrencyFormValues;
  onChange: (patch: Partial<CurrencyFormValues>) => void;
  isSubmitting: boolean;
  /** The code is immutable after creation — `UpdateCurrencyDto` omits `code` and `decimalPlaces`. */
  codeReadOnly: boolean;
  /** Lock the stored default on edit; creation may need a rate for rebasing. */
  rateLocked: boolean;
  showDefaultToggle: boolean;
  rateRequiredOnEdit?: boolean;
  baseStatus?: BaseCurrencyStatus;
  baseCurrencyCode?: string | null;
  firstCurrencyDefault?: boolean;
  rateRequired?: boolean;
  errors?: CurrencyFieldErrors;
  errorSummary?: readonly CurrencyErrorSummaryItem[];
  anchorIds?: Partial<Record<CurrencyFieldName, string>>;
  fieldRefs?: CurrencyFieldRefs;
  onBlurField?: (field: CurrencyFieldName) => void;
  onFocusField?: (field: CurrencyFieldName) => void;
}

function ReadOnlyLock() {
  return (
    <Lock
      aria-hidden="true"
      className="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
    />
  );
}

export function CurrencyFormFields({
  values, onChange, isSubmitting, codeReadOnly, rateLocked, showDefaultToggle,
  rateRequiredOnEdit = true, baseStatus, baseCurrencyCode, firstCurrencyDefault,
  rateRequired: rateRequiredOverride, errors, errorSummary, anchorIds, fieldRefs,
  onBlurField, onFocusField,
}: CurrencyFormFieldsProps) {
  const { t } = useI18n();
  const defaultToggleId = useId();
  const defaultHintId = `${defaultToggleId}-hint`;
  const summaryHeadingId = `${defaultToggleId}-summary`;

  const spendableCodes = useMemo(
    () => (codeReadOnly ? [] : supportedSpendableCurrencyCodes()),
    [codeReadOnly],
  );
  const useCodeChoice = !codeReadOnly && spendableCodes.length > 0;
  const derivedMinorUnits = deriveCurrencyMinorUnits(values.code);
  const displayedDecimalPlaces = codeReadOnly
    ? values.decimalPlaces
    : derivedMinorUnits === null ? "" : String(derivedMinorUnits);

  const baseMode = codeReadOnly
    ? "existing-base"
    : resolveCreateCurrencyBaseMode(baseStatus, baseCurrencyCode);
  const isFirstCurrency =
    firstCurrencyDefault ?? (!codeReadOnly && baseMode === "first-currency" && !errors?.exchangeRate);
  const effectiveRateLocked = rateLocked || isFirstCurrency;
  const displayedExchangeRate = isFirstCurrency ? "1" : values.exchangeRate;
  const rateRequired =
    rateRequiredOverride ??
    isCurrencyRateRequired({
      mode: codeReadOnly ? "edit" : "create",
      rateLocked: effectiveRateLocked,
      rateRequiredOnEdit,
      isDefault: values.isDefault,
      baseMode,
    });

  const normalizedCode = values.code.trim().toUpperCase();
  const showRateEquation =
    Boolean(baseCurrencyCode) &&
    !effectiveRateLocked &&
    !errors?.exchangeRate &&
    /^[A-Z]{3}$/u.test(normalizedCode) &&
    normalizedCode !== baseCurrencyCode &&
    (codeReadOnly
      ? hasValidSavedExchangeRate(values.exchangeRate)
      : isValidTypedExchangeRate(values.exchangeRate));

  const rateHint = effectiveRateLocked
    ? t.coreSettings.currencyRateLockedHint
    : showRateEquation
      ? undefined
      : baseCurrencyCode
        ? formatTemplate(t.coreSettings.currencyRatePerBaseHint, { base: baseCurrencyCode })
        : showDefaultToggle && values.isDefault
          ? t.coreSettings.currencyCreateDefaultRateHint
          : t.coreSettings.currencyRateHint;

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-3">
        {errorSummary && errorSummary.length > 0 ? (
          <div
            role="alert"
            aria-labelledby={summaryHeadingId}
            className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p id={summaryHeadingId} className="font-medium">{t.coreSettings.currencyFormErrorSummary}</p>
              <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {errorSummary.map((item) => (
                  <li key={item.field}>
                    <a
                      href={`#${item.anchorId}`}
                      onClick={(event) => { event.preventDefault(); onFocusField?.(item.field); }}
                      className={cn("rounded-xs font-medium underline underline-offset-2", focusRing)}
                    >
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div id={anchorIds?.code} className="min-w-0">
            <Field
              label={t.coreSettings.currencyCode}
              hint={codeReadOnly ? t.coreSettings.currencyCodeImmutable : t.coreSettings.currencyCodeHint}
              hintPlacement="tooltip"
              error={errors?.code}
              readOnly={codeReadOnly}
              showLabel
              required={!codeReadOnly}
            >
              {useCodeChoice ? (
                <Select value={values.code} onValueChange={(code) => onChange({ code })} disabled={isSubmitting}>
                  <SelectTrigger
                    ref={typeof fieldRefs?.code === "function" ? fieldRefs.code : undefined}
                    size="sm"
                    dir="ltr"
                    className="font-mono uppercase"
                    onBlur={() => onBlurField?.("code")}
                  >
                    <SelectValue placeholder={t.coreSettings.currencyCode} />
                  </SelectTrigger>
                  <SelectContent>
                    {spendableCodes.map((code) => (
                      <SelectItem key={code} value={code} dir="ltr" className="font-mono">{code}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div dir="ltr" className="relative">
                  <Input
                    ref={fieldRefs?.code} size="sm" placeholder={t.coreSettings.currencyCode} dir="ltr"
                    autoComplete="off" spellCheck={false} className={cn("font-mono uppercase", codeReadOnly && "pe-8")}
                    value={values.code} onChange={(event) => onChange({ code: event.target.value.toUpperCase() })}
                    onBlur={() => onBlurField?.("code")} maxLength={CURRENCY_CODE_LENGTH}
                    disabled={isSubmitting} readOnly={codeReadOnly} required={!codeReadOnly}
                  />
                  {codeReadOnly ? <ReadOnlyLock /> : null}
                </div>
              )}
            </Field>
          </div>

          <div id={anchorIds?.name} className="min-w-0">
            <Field label={t.coreSettings.currencyName} error={errors?.name} showLabel required>
              <Input
                ref={fieldRefs?.name} size="sm" placeholder={t.coreSettings.currencyName} autoComplete="off"
                value={values.name} onChange={(event) => onChange({ name: event.target.value })}
                onBlur={() => onBlurField?.("name")} maxLength={CURRENCY_NAME_MAX_LENGTH}
                disabled={isSubmitting} required
              />
            </Field>
          </div>
        </div>

        <div
          className={cn(
            "grid grid-cols-1 gap-3",
            codeReadOnly
              ? "sm:grid-cols-[minmax(0,1.35fr)_minmax(0,0.75fr)_minmax(0,0.9fr)]"
              : "sm:grid-cols-[minmax(0,0.9fr)_minmax(0,0.75fr)_minmax(0,1.35fr)]",
          )}
        >
          <div id={anchorIds?.symbol} className="order-2 min-w-0">
            <Field label={t.coreSettings.currencySymbol} error={errors?.symbol} showLabel>
              <Input
                ref={fieldRefs?.symbol} size="sm" placeholder={t.coreSettings.currencySymbol} autoComplete="off"
                value={values.symbol} onChange={(event) => onChange({ symbol: event.target.value })}
                onBlur={() => onBlurField?.("symbol")} maxLength={CURRENCY_SYMBOL_MAX_LENGTH}
                disabled={isSubmitting}
              />
            </Field>
          </div>

          <div id={anchorIds?.decimalPlaces} className={cn("min-w-0", codeReadOnly ? "order-3" : "order-1")}>
            <Field
              label={t.coreSettings.currencyDecimalPlaces}
              hint={codeReadOnly ? t.coreSettings.currencyDecimalPlacesImmutable : t.coreSettings.currencyDecimalPlacesDerived}
              hintPlacement="tooltip"
              error={errors?.decimalPlaces}
              readOnly
              showLabel
            >
              <div dir="ltr" className="relative">
                <Input
                  ref={fieldRefs?.decimalPlaces} size="sm" placeholder="—" dir="ltr" autoComplete="off"
                  className="pe-8 font-mono tabular-nums" value={displayedDecimalPlaces}
                  disabled={isSubmitting} readOnly
                />
                <ReadOnlyLock />
              </div>
            </Field>
          </div>

          <div id={anchorIds?.exchangeRate} className={cn("min-w-0", codeReadOnly ? "order-1" : "order-3")}>
            <Field
              label={t.coreSettings.currencyExchangeRate}
              hint={rateHint}
              hintPlacement={effectiveRateLocked ? "tooltip" : "below"}
              error={errors?.exchangeRate}
              readOnly={effectiveRateLocked}
              showLabel
              required={rateRequired}
            >
              <div dir="ltr" className="relative">
                <Input
                  ref={fieldRefs?.exchangeRate} size="sm" placeholder={t.coreSettings.currencyExchangeRate}
                  dir="ltr" inputMode="decimal" autoComplete="off"
                  className={cn("font-mono tabular-nums", effectiveRateLocked && "pe-8")}
                  value={displayedExchangeRate} onChange={(event) => onChange({ exchangeRate: event.target.value })}
                  onBlur={() => onBlurField?.("exchangeRate")} disabled={isSubmitting}
                  readOnly={effectiveRateLocked} required={rateRequired}
                />
                {effectiveRateLocked ? <ReadOnlyLock /> : null}
              </div>
            </Field>
            {showRateEquation ? (
              <p dir="ltr" className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
                1 {baseCurrencyCode} = {values.exchangeRate.trim()} {normalizedCode}
              </p>
            ) : null}
          </div>
        </div>

        {showDefaultToggle ? (
          <div className="flex items-start gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-2.5">
            <Checkbox
              id={defaultToggleId}
              checked={isFirstCurrency ? true : values.isDefault}
              onCheckedChange={(checked) => { if (!isFirstCurrency) onChange({ isDefault: checked === true }); }}
              aria-describedby={defaultHintId}
              disabled={isSubmitting || isFirstCurrency}
              className="mt-0.5"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Label htmlFor={defaultToggleId} className={cn("text-xs font-medium", !isFirstCurrency && "cursor-pointer")}>
                {t.coreSettings.currencyMakeDefault}
              </Label>
              <p id={defaultHintId} className="text-xs text-muted-foreground">
                {isFirstCurrency ? t.coreSettings.workspaceCurrencyHint : t.coreSettings.currencyMakeDefaultHint}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
