"use client";

import { Button, Field, Input, Money } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { FINANCIAL_TOTAL_KEYS, type FinancialTotals } from "../../documents/financial-totals";
import type { InvoiceDraftLinePayload } from "../invoice-contract";
import { tradeDecimalError } from "../../documents/lib/trade-evidence-validation";

interface Props {
  lines: InvoiceDraftLinePayload[];
  roundingTotal: string;
  currencyCode: string;
  totals: FinancialTotals | null;
  disabled: boolean;
  onUpdate: (index: number, patch: Partial<InvoiceDraftLinePayload>) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onRoundingChange: (value: string) => void;
}

export function InvoiceDraftLinesEditor(props: Props) {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const fields = [
    ["itemId", td.item], ["uomId", td.uom], ["description", td.lineEditor.descriptionPreview],
    ["quantity", td.quantity], ["unitPrice", td.unitPrice],
    ["discountTotal", td.totals.discountTotal], ["chargeTotal", td.totals.chargeTotal],
    ["taxTotal", td.totals.taxTotal],
  ] as const;
  return (
    <div className="space-y-3">
      {props.lines.map((line, index) => (
        <div key={line.clientLineId} className="dossier-card space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {fields.map(([key, label]) => {
              const message = key === "itemId" || key === "uomId" || key === "description" ? undefined
                : tradeDecimalError(line[key], key === "quantity");
              return <Field key={key} label={label} error={message ? td.lineEditor[message] : undefined}>
                <Input size="sm" value={line[key] ?? ""} disabled={props.disabled}
                  onChange={(event) => props.onUpdate(index, { [key]: event.target.value })} />
              </Field>;
            })}
          </div>
          <Button type="button" variant="ghost" disabled={props.disabled || props.lines.length < 2}
            onClick={() => props.onRemove(index)}>{td.lineEditor.removeLine}</Button>
        </div>
      ))}
      <Button type="button" variant="outline" disabled={props.disabled} onClick={props.onAdd}>
        {td.lineEditor.addLine}
      </Button>
      <Field label={td.totals.roundingTotal} error={tradeDecimalError(props.roundingTotal) ? td.lineEditor.decimalInvalid : undefined}>
        <Input size="sm" inputMode="decimal" value={props.roundingTotal} disabled={props.disabled}
          onChange={(event) => props.onRoundingChange(event.target.value)} />
      </Field>
      {!props.totals ? <p role="alert" className="text-sm text-destructive">{td.lineEditor.calculationInvalid}</p> : null}
      {props.totals ? (
        <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/40 p-3 sm:grid-cols-4">
          {FINANCIAL_TOTAL_KEYS.map((key) => (
            <div key={key}>
              <span className="block text-xs text-muted-foreground">{td.totals[key]}</span>
              <Money value={props.totals![key]} currency={props.currencyCode}
                minimumFractionDigits={2} maximumFractionDigits={8} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
