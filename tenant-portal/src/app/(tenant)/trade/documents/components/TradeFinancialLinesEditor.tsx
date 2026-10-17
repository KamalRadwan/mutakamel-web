"use client";

import * as React from "react";
import { Calculator, CheckCircle2, Plus, Trash2 } from "lucide-react";
import {
  Button,
  Field,
  IdentifierText,
  Input,
  Money,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import {
  computeTradeEvidence,
  createEmptyEvidenceLineDraft,
  type ComputedTradeDocumentTotals,
  type TradeEvidenceDialect,
  type TradeEvidenceLineDraft,
} from "../lib/trade-financial-evidence";

export interface TradeFinancialLinesEditorProps {
  dialect: TradeEvidenceDialect;
  currencyCode: string;
  lines: TradeEvidenceLineDraft[];
  onChangeLines: (next: TradeEvidenceLineDraft[]) => void;
  roundingTotal?: string;
  onChangeRoundingTotal?: (next: string) => void;
  amountPaid?: string;
  onChangeAmountPaid?: (next: string) => void;
  showAmountPaid?: boolean;
  disabled?: boolean;
}

export function TradeFinancialLinesEditor({
  dialect,
  currencyCode,
  lines,
  onChangeLines,
  roundingTotal = "0.00000000",
  onChangeRoundingTotal,
  amountPaid = "0.00000000",
  onChangeAmountPaid,
  showAmountPaid = false,
  disabled = false,
}: TradeFinancialLinesEditorProps) {
  const { t } = useI18n();
  const td = t.tradeDocuments;

  const computed: ComputedTradeDocumentTotals = React.useMemo(
    () =>
      computeTradeEvidence(lines, {
        dialect,
        currencyCode,
        roundingTotal,
        amountPaid,
      }),
    [lines, dialect, currencyCode, roundingTotal, amountPaid],
  );

  function updateLine(index: number, patch: Partial<TradeEvidenceLineDraft>) {
    onChangeLines(
      lines.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="dossier-icon-pill dossier-ip-indigo" aria-hidden>
            <Calculator className="h-4 w-4" />
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {td.executive.linesEditorTitle}
            </h4>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span className="dossier-tag dossier-tag-indigo">
                {dialect === "FINANCIAL"
                  ? td.executive.dialectFinancialBadge
                  : td.executive.dialectOrderBadge}
              </span>
              <span className="dossier-tag dossier-tag-emerald">
                <CheckCircle2 className="me-1 h-3 w-3" aria-hidden />
                {td.executive.evidenceVerifiedBadge}
              </span>
            </div>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() =>
            onChangeLines([...lines, createEmptyEvidenceLineDraft()])
          }
        >
          <Plus className="me-1.5 h-3.5 w-3.5" aria-hidden />
          {td.lineEditor.addLine}
        </Button>
      </div>

      <div className="space-y-3">
        {lines.map((row, idx) => {
          const calcLine = computed.lines[idx];
          return (
            <div
              key={row.id}
              className="dossier-card dossier-card-indigo space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="trade-clause-order-badge">
                    <IdentifierText>{`#${idx + 1}`}</IdentifierText>
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    {td.item}{" "}
                    <IdentifierText>{String(idx + 1)}</IdentifierText>
                  </span>
                </div>
                {lines.length > 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled}
                    onClick={() =>
                      onChangeLines(lines.filter((_, i) => i !== idx))
                    }
                    aria-label={td.lineEditor.removeLine}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                  </Button>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label={td.item} required>
                  <Input
                    size="sm"
                    value={row.itemId}
                    disabled={disabled}
                    onChange={(e) => updateLine(idx, { itemId: e.target.value })}
                    placeholder="UUID"
                  />
                </Field>

                <Field label={td.uom} required>
                  <Input
                    size="sm"
                    value={row.uomCode}
                    disabled={disabled}
                    onChange={(e) =>
                      updateLine(idx, { uomCode: e.target.value })
                    }
                    placeholder="UUIDv7"
                  />
                </Field>

                <Field label={td.lineEditor.descriptionPreview} required>
                  <Input
                    size="sm"
                    value={row.description}
                    disabled={disabled}
                    onChange={(e) =>
                      updateLine(idx, { description: e.target.value })
                    }
                    placeholder={td.lineEditor.descriptionPreview}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Field label={td.quantity} required>
                  <Input
                    size="sm"
                    inputMode="decimal"
                    value={row.quantity}
                    disabled={disabled}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                    placeholder={td.quantity}
                  />
                </Field>

                <Field label={td.unitPrice} required>
                  <Input
                    size="sm"
                    inputMode="decimal"
                    value={row.unitPrice}
                    disabled={disabled}
                    onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                    placeholder={td.unitPrice}
                  />
                </Field>

                <Field label={td.executive.discountAmountLabel}>
                  <Input
                    size="sm"
                    inputMode="decimal"
                    value={row.discountAmount}
                    disabled={disabled}
                    onChange={(e) =>
                      updateLine(idx, { discountAmount: e.target.value })
                    }
                    placeholder="0.00000000"
                  />
                </Field>

                {dialect === "FINANCIAL" ? (
                  <Field label={td.executive.chargeAmountLabel}>
                    <Input
                      size="sm"
                      inputMode="decimal"
                      value={row.chargeAmount}
                      disabled={disabled}
                      onChange={(e) =>
                        updateLine(idx, { chargeAmount: e.target.value })
                      }
                      placeholder="0.00000000"
                    />
                  </Field>
                ) : (
                  <Field label={td.executive.taxCodeLabel}>
                    <Input
                      size="sm"
                      value={row.taxCode}
                      disabled={disabled}
                      onChange={(e) => updateLine(idx, { taxCode: e.target.value })}
                      placeholder="VAT-15"
                    />
                  </Field>
                )}

                <Field label={td.executive.taxRatePercentLabel}>
                  <Input
                    size="sm"
                    inputMode="decimal"
                    value={row.taxRatePercent}
                    disabled={disabled}
                    onChange={(e) =>
                      updateLine(idx, { taxRatePercent: e.target.value })
                    }
                    placeholder="15"
                  />
                </Field>
              </div>

              {calcLine ? (
                <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-2.5 text-xs sm:grid-cols-4">
                  <div>
                    <span className="block text-muted-foreground">
                      {td.totals.subtotal}
                    </span>
                    <Money
                      value={calcLine.grossAmount}
                      currency={currencyCode}
                      minimumFractionDigits={2}
                      maximumFractionDigits={8}
                      className="font-semibold text-foreground"
                    />
                  </div>
                  <div>
                    <span className="block text-muted-foreground">
                      {td.executive.discountAmountLabel}
                    </span>
                    <Money
                      value={calcLine.discountAmount}
                      currency={currencyCode}
                      minimumFractionDigits={2}
                      maximumFractionDigits={8}
                      className="font-semibold text-foreground"
                    />
                  </div>
                  <div>
                    <span className="block text-muted-foreground">
                      {td.totals.taxTotal}
                    </span>
                    <Money
                      value={calcLine.taxAmount}
                      currency={currencyCode}
                      minimumFractionDigits={2}
                      maximumFractionDigits={8}
                      className="font-semibold text-foreground"
                    />
                  </div>
                  <div>
                    <span className="block text-muted-foreground">
                      {td.lineTotal}
                    </span>
                    <Money
                      value={calcLine.lineTotal}
                      currency={currencyCode}
                      minimumFractionDigits={2}
                      maximumFractionDigits={8}
                      className="font-semibold text-primary"
                    />
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {showAmountPaid || (dialect === "FINANCIAL" && onChangeRoundingTotal) ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {dialect === "FINANCIAL" && onChangeRoundingTotal ? (
            <Field label={td.executive.computedRounding}>
              <Input
                size="sm"
                inputMode="decimal"
                value={roundingTotal}
                disabled={disabled}
                onChange={(e) => onChangeRoundingTotal(e.target.value)}
                placeholder="0.00000000"
              />
            </Field>
          ) : null}
          {showAmountPaid && onChangeAmountPaid ? (
            <Field label={td.executive.amountPaidLabel}>
              <Input
                size="sm"
                inputMode="decimal"
                value={amountPaid}
                disabled={disabled}
                onChange={(e) => onChangeAmountPaid(e.target.value)}
                placeholder="0.00000000"
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      <div className="trade-totals-ribbon">
        <div className="trade-totals-cell">
          <span className="block text-xs text-muted-foreground">
            {td.executive.computedSubtotal}
          </span>
          <Money
            value={computed.subtotal}
            currency={currencyCode}
            minimumFractionDigits={2}
            maximumFractionDigits={8}
            className="text-sm font-semibold text-foreground"
          />
        </div>
        <div className="trade-totals-cell">
          <span className="block text-xs text-muted-foreground">
            {td.executive.computedDiscount}
          </span>
          <Money
            value={computed.discountTotal}
            currency={currencyCode}
            minimumFractionDigits={2}
            maximumFractionDigits={8}
            className="text-sm font-semibold text-foreground"
          />
        </div>
        {dialect === "FINANCIAL" ? (
          <div className="trade-totals-cell">
            <span className="block text-xs text-muted-foreground">
              {td.executive.computedCharges}
            </span>
            <Money
              value={computed.chargeTotal}
              currency={currencyCode}
              minimumFractionDigits={2}
              maximumFractionDigits={8}
              className="text-sm font-semibold text-foreground"
            />
          </div>
        ) : null}
        <div className="trade-totals-cell">
          <span className="block text-xs text-muted-foreground">
            {td.executive.computedTax}
          </span>
          <Money
            value={computed.taxTotal}
            currency={currencyCode}
            minimumFractionDigits={2}
            maximumFractionDigits={8}
            className="text-sm font-semibold text-foreground"
          />
        </div>
        <div className="trade-totals-cell trade-totals-cell-grand">
          <span className="block text-xs text-muted-foreground">
            {td.executive.computedGrandTotal}
          </span>
          <Money
            value={computed.grandTotal}
            currency={currencyCode}
            minimumFractionDigits={2}
            maximumFractionDigits={8}
            className="text-sm font-semibold text-foreground"
          />
        </div>
        {showAmountPaid ? (
          <div className="trade-totals-cell trade-totals-cell-due">
            <span className="block text-xs text-muted-foreground">
              {td.executive.computedAmountDue}
            </span>
            <Money
              value={computed.amountDue}
              currency={currencyCode}
              minimumFractionDigits={2}
              maximumFractionDigits={8}
              className="text-sm font-semibold text-foreground"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
