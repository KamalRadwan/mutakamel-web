"use client";

import { RotateCcw } from "lucide-react";
import {
  Button,
  Combobox,
  ErrorState,
  Field,
  IdentifierText,
  Input,
  PermissionGate,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn,
} from "@/design-system";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  PRICE_BOOK_PURPOSES,
  localizedRecordName,
} from "../../price-books/pricing-contract";
import type { PricingScenarioPreset } from "../pricing-display";
import type { EvaluateFormValues } from "../hooks/usePricingEvaluation";
import type { usePricingWorkbench } from "../hooks/usePricingWorkbench";

import { PricingAdvancedInputs } from "./PricingAdvancedInputs";

const SCENARIO_PRESETS: readonly PricingScenarioPreset[] = ["retail", "wholesale", "vip"];

interface PricingInputsCardProps {
  workbench: ReturnType<typeof usePricingWorkbench>;
}

export function PricingInputsCard({ workbench }: PricingInputsCardProps) {
  const {
    t,
    lang,
    isScopeResolved,
    isEvaluating,
    values,
    formError,
    currencies,
    isLoadingRefData,
    selectedCurrencyLabel,
    uoms,
    selectedItem,
    allItemOptions,
    itemOptions,
    setItemSearch,
    allAccountOptions,
    accountOptions,
    setAccountSearch,
    activePreset,
    selectScenarioPreset,
    selectPurpose,
    selectCurrencyCode,
    selectItem,
    normalizeQuantityBlur,
    setValue,
    resetAll,
    evaluate,
  } = workbench;

  const controlsDisabled = isEvaluating || !isScopeResolved;
  const currencyDenied = !currencies.canRead || currencies.error?.status === 403;
  const currencyErrorContent = currencyDenied ? (
    <PermissionGate denied require="currencies.currency.read">{null}</PermissionGate>
  ) : currencies.error ? (
    <ErrorState
      title={t.coreSettings.currencyLoadFailed}
      description={currencies.error.message}
      onRetry={currencies.retry}
      retryLabel={t.common.retry}
    />
  ) : undefined;


  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void evaluate();
      }}
      className="flex flex-col gap-3.5 rounded-column border border-line-card bg-card p-4 shadow-column lg:col-span-4"
    >
      <div className="flex items-center justify-between gap-2 border-b border-line-divider pb-2.5">
        <h2 className="text-sm font-semibold text-foreground">{t.tradePricing.evalInputsTitle}</h2>
        <Button type="button" size="xs" variant="ghost" onClick={resetAll} disabled={isEvaluating}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          <span>{t.tradePricing.evalResetAction}</span>
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground">{t.tradePricing.evalScenarioLabel}</span>
        <div role="group" aria-label={t.tradePricing.evalScenarioLabel} className="grid grid-cols-3 gap-2">
          {SCENARIO_PRESETS.map((preset) => {
            const isActive = activePreset === preset;
            const label =
              preset === "retail"
                ? t.tradePricing.evalScenarioRetail
                : preset === "wholesale"
                  ? t.tradePricing.evalScenarioWholesale
                  : t.tradePricing.evalScenarioVip;
            return (
              <Button
                key={preset}
                type="button"
                size="sm"
                variant="outline"
                disabled={controlsDisabled}
                aria-pressed={isActive}
                onClick={() => selectScenarioPreset(preset)}
                className={cn(
                  "w-full text-xs",
                  isActive && "border-chip-active-line bg-selected font-semibold text-selected-foreground",
                )}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <Field label={t.tradePricing.bookPurpose} showLabel required>
          <Select
            value={values.purpose}
            disabled={controlsDisabled}
            onValueChange={(next) => selectPurpose(next as EvaluateFormValues["purpose"])}
          >
            <SelectTrigger size="sm" aria-label={t.tradePricing.bookPurpose}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICE_BOOK_PURPOSES.map((purpose) => (
                <SelectItem key={purpose} value={purpose}>
                  {tradeStatusLabel(t.tradeStatus, purpose, t.common.unknownCode)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t.tradePricing.currencyCode} showLabel required>
          <Combobox
            value={values.currencyCode.trim().toUpperCase() || undefined}
            selectedLabel={selectedCurrencyLabel}
            onValueChange={selectCurrencyCode}
            options={currencies.options}
            onSearch={currencies.setSearch}
            debounceMs={0}
            loading={currencies.loading}
            placeholder={t.tradePricing.currencySelect}
            searchPlaceholder={t.coreSettings.currencySearch}
            loadingLabel={t.common.loading}
            emptyLabel={t.coreSettings.currencyEmpty}
            errorContent={currencyErrorContent}
            disabled={controlsDisabled}
            wrapLabels
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1">
        <Field label={t.tradePricing.evalItemLabel} showLabel required>
          <Combobox
            value={values.itemId || undefined}
            selectedLabel={allItemOptions.find((opt) => opt.value === values.itemId)?.label}
            options={itemOptions}
            onSearch={setItemSearch}
            debounceMs={0}
            loading={isLoadingRefData}
            loadingLabel={t.common.loading}
            disabled={controlsDisabled}
            onValueChange={selectItem}
            placeholder={t.tradePricing.selectItemPlaceholder}
            searchPlaceholder={t.common.search}
            emptyLabel={t.common.noData}
            wrapLabels
          />
        </Field>
        {selectedItem ? (
          <IdentifierText className="text-xs text-muted-foreground">
            {selectedItem.canonicalCode}
          </IdentifierText>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label={t.tradePricing.uomColumn} showLabel required>
          <Select
            value={values.uomId}
            disabled={controlsDisabled || uoms.length === 0}
            onValueChange={(next) => setValue({ uomId: next })}
          >
            <SelectTrigger size="sm" aria-label={t.tradePricing.uomColumn}>
              <SelectValue placeholder={t.tradePricing.selectUomPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {uoms.map((uom) => (
                <SelectItem key={uom.id} value={uom.id}>
                  {localizedRecordName(uom.localizedNames, uom.displayName || uom.code, lang)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label={t.tradeInventory.quantity} showLabel required>
          <Input
            size="sm"
            dir="ltr"
            inputMode="decimal"
            className="font-mono font-medium tabular-nums"
            placeholder="10"
            value={values.quantity}
            disabled={controlsDisabled}
            onChange={(event) => setValue({ quantity: event.target.value })}
            onBlur={normalizeQuantityBlur}
          />
        </Field>
      </div>

      <Field label={t.tradePricing.evalCommercialAccountLabel} showLabel>
        <Combobox
          value={values.partyId || undefined}
          selectedLabel={allAccountOptions.find((opt) => opt.value === values.partyId)?.label}
          options={accountOptions}
          onSearch={setAccountSearch}
          debounceMs={0}
          loading={isLoadingRefData}
          loadingLabel={t.common.loading}
          clearLabel={t.tradePricing.evalResetAction}
          disabled={controlsDisabled}
          onValueChange={(next) => setValue({ partyId: next ?? "" })}
          placeholder={t.tradePricing.selectPartyPlaceholder}
          searchPlaceholder={t.common.search}
          emptyLabel={t.tradePricing.linkedAccountsEmpty}
          wrapLabels
        />
      </Field>

      <PricingAdvancedInputs workbench={workbench} disabled={controlsDisabled} />

      {formError ? (
        <p role="alert" className="rounded-md bg-destructive-subtle px-3 py-2 text-xs text-destructive-subtle-foreground">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5 pt-0.5">
        <Button type="submit" variant="primary" size="md" loading={isEvaluating} disabled={controlsDisabled} className="w-full">
          {t.tradePricing.evalRunAction}
        </Button>
        <p className="text-center text-xs text-muted-foreground">{t.tradePricing.evalReadOnlyNote}</p>
      </div>
    </form>
  );
}
