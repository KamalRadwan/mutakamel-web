"use client";
import { Button } from "@/design-system";
import type { InspectorCopy } from "@/i18n/dictionaries/template-inspector";
import { inspectorRecord } from "./inspector-contract";
import { InspectorSelect } from "./InspectorFields";
import { useInspectorCurrency } from "./useInspectorCurrency";
import { useInspectorPorts } from "./useInspectorPorts";

export function InspectorCurrencyField({ value, onValue, disabled, copy: c }: { value: unknown; onValue: (value: Record<string, unknown>) => void; disabled: boolean; copy: InspectorCopy }) {
  const ports = useInspectorPorts(), currency = useInspectorCurrency(value, onValue, disabled || ports.disabled);
  const current = String(inspectorRecord(inspectorRecord(value).format).currencyCodePath ?? "INHERIT");
  const paths = [...currency.paths, ...(current !== "INHERIT" && !currency.paths.includes(current) ? [current] : [])];
  return <div className="space-y-2">
    <Button type="button" size="sm" variant="outline" loading={currency.state === "checking"} disabled={!currency.canQualify} onClick={() => void currency.qualify()}>{c.qualifyCurrencyFields}</Button>
    <InspectorSelect label={c.currencyCodePath} value={current} disabled={currency.state !== "ready" || disabled || ports.disabled} options={[...(currency.allowContextCurrency || current === "INHERIT" ? [{ value: "INHERIT", label: c.inherit, disabled: !currency.allowContextCurrency }] : []), ...paths.map(value => ({ value, label: value, disabled: !currency.paths.includes(value) }))]} onValue={currency.choose} />
    <p role="status" className="text-xs text-muted-foreground">{currency.state === "checking" ? c.currencyChecking : currency.state === "invalidDraft" ? c.currencyFixDraft : currency.state !== "ready" ? c.currencyUnavailable : currency.paths.length ? c.currencyQualified : currency.allowContextCurrency ? c.currencyNone : c.currencyUnavailable}</p>
  </div>;
}
