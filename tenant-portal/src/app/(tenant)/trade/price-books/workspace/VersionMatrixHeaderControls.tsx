"use client";

import { Calculator, Plus, Search } from "lucide-react";
import { Button, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { PRICE_ADJUSTMENT_MODES, PRICE_ENTRIES_MAX, PRICE_ROUNDING_MODES, SIGNED_DECIMAL_16_8_PATTERN, type PriceAdjustmentMode, type PriceRoundingMode } from "../pricing-contract";
import { formatDraftValidationIssue } from "../pricing-messages";
import { applyBulkFormulaToDraftEntries } from "../version-draft";
import { useVersionMatrixControls, type VersionMatrixHeaderControlsProps } from "./hooks/useVersionMatrixControls";
export function VersionMatrixHeaderControls(props: VersionMatrixHeaderControlsProps) {
  const { detail, draft, editable, currencyDecimalPlaces, matchingKeys, search, onChangeSearch, onChangeDraft, onAddRow, t, lang, bulkOpen, setBulkOpen, bulkMode, setBulkMode, bulkValue, setBulkValue, bulkRounding, setBulkRounding, dateIssue } = useVersionMatrixControls(props);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2.5 rounded-card border border-border bg-card p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xs font-semibold text-foreground">
            {t.tradePricing.versionDatesSectionTitle}
          </h3>
          <span className="text-caption text-muted-foreground">
            {t.tradePricing.timezoneHintLabel}
          </span>
        </div>
        {editable ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field
              label={t.tradePricing.effectiveFrom}
              showLabel
              required
              error={
                dateIssue("effectiveFrom")
                  ? formatDraftValidationIssue(dateIssue("effectiveFrom")!, t.tradePricing)
                  : undefined
              }
            >
              <Input
                id="version-effectiveFrom"
                type="datetime-local"
                size="sm"
                value={draft.effectiveFrom}
                onChange={(e) =>
                  onChangeDraft((prev) => ({ ...prev, effectiveFrom: e.target.value }))
                }
              />
            </Field>
            <Field
              label={t.tradePricing.effectiveTo}
              showLabel
              error={
                dateIssue("effectiveTo")
                  ? formatDraftValidationIssue(dateIssue("effectiveTo")!, t.tradePricing)
                  : undefined
              }
            >
              <Input
                id="version-effectiveTo"
                type="datetime-local"
                size="sm"
                value={draft.effectiveTo}
                onChange={(e) =>
                  onChangeDraft((prev) => ({ ...prev, effectiveTo: e.target.value }))
                }
              />
            </Field>
            <Field
              label={t.tradePricing.versionNotesLabel}
              showLabel
              error={
                dateIssue("notes")
                  ? formatDraftValidationIssue(dateIssue("notes")!, t.tradePricing)
                  : undefined
              }
            >
              <Input
                id="version-notes"
                size="sm"
                placeholder={t.tradePricing.versionNotesPlaceholder}
                value={draft.notes ?? ""}
                onChange={(e) =>
                  onChangeDraft((prev) => ({ ...prev, notes: e.target.value }))
                }
              />
            </Field>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <span>
              <strong className="font-medium text-foreground">
                {t.tradePricing.effectiveFrom}:
              </strong>{" "}
              {formatDateTime(detail.version.effectiveFrom, lang)}
            </span>
            <span>
              <strong className="font-medium text-foreground">
                {t.tradePricing.effectiveTo}:
              </strong>{" "}
              {detail.version.effectiveTo
                ? formatDateTime(detail.version.effectiveTo, lang)
                : t.tradePricing.openEndedWindow}
            </span>
            {detail.version.notes ? (
              <span>
                <strong className="font-medium text-foreground">
                  {t.tradePricing.versionNotesLabel}:
                </strong>{" "}
                {detail.version.notes}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative min-w-56 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="matrix-search-input"
            aria-label={t.tradePricing.searchMatrixPlaceholder}
            size="sm"
            className="ps-8"
            placeholder={t.tradePricing.searchMatrixPlaceholder}
            value={search}
            onChange={(e) => onChangeSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editable && draft.entries.length > 0 ? (
            <Button size="sm" variant="outline" onClick={() => setBulkOpen((o) => !o)}>
              <Calculator className="me-1.5 size-3.5" aria-hidden="true" />
              {t.tradePricing.bulkFormulaTitle}
            </Button>
          ) : null}
          {editable ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={draft.entries.length >= PRICE_ENTRIES_MAX}
              onClick={onAddRow}
            >
              <Plus className="me-1.5 size-3.5" aria-hidden="true" />
              {t.tradePricing.addItemTierAction}
            </Button>
          ) : null}
        </div>
      </div>

      {editable && bulkOpen ? (
        <div className="grid grid-cols-1 items-end gap-2.5 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-4">
          <Field label={t.tradePricing.adjustmentModeLabel} showLabel>
            <Select value={bulkMode} onValueChange={(v) => setBulkMode(v as PriceAdjustmentMode)}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_ADJUSTMENT_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m === "NONE"
                      ? t.tradePricing.adjustmentNone
                      : m === "PERCENTAGE"
                        ? t.tradePricing.adjustmentPercentage
                        : t.tradePricing.adjustmentFixed}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t.tradePricing.adjustmentValueLabel} showLabel>
            <Input
              size="sm"
              inputMode="decimal"
              disabled={bulkMode === "NONE"}
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
            />
          </Field>
          <Field label={t.tradePricing.roundingModeLabel} showLabel>
            <Select value={bulkRounding} onValueChange={(v) => setBulkRounding(v as PriceRoundingMode)}>
              <SelectTrigger size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRICE_ROUNDING_MODES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r === "NONE"
                      ? t.tradePricing.roundingNone
                      : r === "NEAREST_1"
                        ? t.tradePricing.roundingNearest1
                        : r === "NEAREST_0_50"
                          ? t.tradePricing.roundingNearest050
                          : t.tradePricing.roundingEnd95}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            size="sm"
            variant="outline"
            disabled={currencyDecimalPlaces === undefined || (bulkMode !== "NONE" && !SIGNED_DECIMAL_16_8_PATTERN.test(bulkValue.trim()))}
            onClick={() =>
              onChangeDraft((prev) => ({
                ...prev,
                entries: applyBulkFormulaToDraftEntries(
                  prev.entries,
                  bulkMode,
                  bulkValue,
                  bulkRounding,
                  currencyDecimalPlaces,
                  new Set(matchingKeys),
                ),
              }))
            }
          >
            {t.tradePricing.bulkApplyToFiltered}
          </Button>
          <p className="text-caption text-muted-foreground sm:col-span-4">
            {currencyDecimalPlaces === undefined ? t.tradePricing.bulkCurrencyPrecisionUnavailable : t.tradePricing.bulkFloorAdjustmentNotice.replace("{count}", String(matchingKeys.length))}
          </p>
        </div>
      ) : null}
    </div>
  );

}
