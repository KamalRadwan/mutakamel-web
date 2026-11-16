"use client";
import { DataInput, DataNumber, DataSelect } from "./DataControls";
import { FieldPicker } from "./FieldPicker";
import { dataFields } from "./binding-catalogue";
import { dataRecord, type DataDescriptor, type DataValue } from "./binding-contract";
import { useDataCopy } from "./hooks/useDataControls";
import { useDataEditingDisabled } from "./data-editing-context";
import { useDataEligibility } from "./data-eligibility-context";
import type { CurrencyEligibilityRequest } from "./data-eligibility";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";

export function FormatEditor({ value, allowed, change, currencyRequest }: { value: unknown; allowed: readonly string[]; change(value: DataValue | undefined): void; currencyRequest?: CurrencyEligibilityRequest }) {
  const c = useDataCopy(), format = dataRecord(value), type = String(format.type ?? "DEFAULT");
  const disabled = useDataEditingDisabled();
  const eligibilityPort = useDataEligibility();
  const currency = currencyRequest && (allowed.includes("CURRENCY") || type === "CURRENCY") && eligibilityPort ? eligibilityPort.currencies(currencyRequest) : null;
  const patch = (key: string, value: unknown) => change({ ...format, [key]: value });
  const defaults: Record<string, DataValue> = { TEXT: {}, NUMBER: {}, CURRENCY: {}, PERCENTAGE: {}, DATE: { dateStyle: "MEDIUM" }, DATETIME: { dateStyle: "MEDIUM", timeStyle: "SHORT" }, BOOLEAN: { trueText: c.status.TRUE, falseText: c.status.FALSE } };
  return <section className="space-y-3" aria-label={c.format}>
    <Field label={c.format} showLabel><Select disabled={disabled} value={type} onValueChange={type => {
      if (type === "CURRENCY" && (!currency?.writable() || !currency.paths.length && !currency.allowContextCurrency)) return;
      change(type === "DEFAULT" ? undefined : { type, ...defaults[type] });
    }}>
      <SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="DEFAULT">{c.inherited}</SelectItem>{allowed.map(key => <SelectItem key={key} value={key} disabled={key === "CURRENCY" && (!currency || !currency.paths.length && !currency.allowContextCurrency)}>{c.status[key as keyof typeof c.status]}</SelectItem>)}</SelectContent>
    </Select></Field>
    {type !== "DEFAULT" && !allowed.includes(type) && <p role="alert">{c.repair}</p>}
    {["NUMBER", "CURRENCY", "PERCENTAGE"].includes(type) && <div className="grid gap-3 sm:grid-cols-2">
      <DataNumber label={c.minimum} value={format.minimumFractionDigits as number | undefined} change={value => patch("minimumFractionDigits", Number.isNaN(value) ? undefined : value)} />
      <DataNumber label={c.maximum} value={format.maximumFractionDigits as number | undefined} change={value => patch("maximumFractionDigits", Number.isNaN(value) ? undefined : value)} />
    </div>}
    {type === "NUMBER" && <DataSelect label={c.grouping} value={format.useGrouping === false ? "FALSE" : "TRUE"} values={["TRUE", "FALSE"]} change={value => patch("useGrouping", value === "TRUE")} />}
    {type === "TEXT" && <DataSelect label={c.transform} value={String(format.transform ?? "NONE")} values={["NONE", "UPPERCASE", "LOWERCASE"]} change={value => patch("transform", value)} />}
    {["DATE", "DATETIME"].includes(type) && <DataSelect label={c.dateStyle} value={String(format.dateStyle)} values={["SHORT", "MEDIUM", "LONG"]} change={value => patch("dateStyle", value)} />}
    {type === "DATETIME" && <DataSelect label={c.timeStyle} value={String(format.timeStyle)} values={["SHORT", "MEDIUM"]} change={value => patch("timeStyle", value)} />}
    {type === "BOOLEAN" && <><DataInput label={c.trueText} value={String(format.trueText ?? "")} change={value => patch("trueText", value)} /><DataInput label={c.falseText} value={String(format.falseText ?? "")} change={value => patch("falseText", value)} /></>}
    {type === "CURRENCY" && !currency && <p role="status">{c.status.unavailable}</p>}
    {type === "CURRENCY" && <Field label={c.currency} showLabel><Select disabled={disabled || !currency?.writable()} value={String(format.currencyCodePath ?? "DEFAULT")} onValueChange={path => {
      if (!currency?.writable() || (path === "DEFAULT" ? !currency.allowContextCurrency : !currency.paths.includes(path))) return;
      const next = { ...format }; if (path === "DEFAULT") delete next.currencyCodePath; else next.currencyCodePath = path; change(next);
    }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{currency?.allowContextCurrency && <SelectItem value="DEFAULT">{c.inherited}</SelectItem>}{currency?.paths.map(path => <SelectItem key={path} value={path}><bdi dir="ltr">{path}</bdi></SelectItem>)}{typeof format.currencyCodePath === "string" && !currency?.paths.includes(format.currencyCodePath) && <SelectItem value={format.currencyCodePath} disabled><bdi dir="ltr">{format.currencyCodePath}</bdi> · {c.repair}</SelectItem>}</SelectContent></Select></Field>}
  </section>;
}
export function BindingEditor({ value, change, descriptor, rowSourcePath, showFormat = true }: { value: unknown; change(value: DataValue): void; descriptor: DataDescriptor; rowSourcePath?: string; showFormat?: boolean }) {
  const c = useDataCopy(), binding = dataRecord(value), field = dataFields(descriptor, rowSourcePath).find(row => row.path === binding.path)?.field;
  const patch = (key: string, value: unknown) => change({ ...binding, [key]: value });
  return <div className="space-y-4">
    <FieldPicker descriptor={descriptor} rowSourcePath={rowSourcePath} value={String(binding.path ?? "")} change={path => change({ path, nullBehavior: "EMPTY" })} />
    {!!binding.path && !field && <p role="alert">{c.repair} <bdi dir="ltr">{String(binding.path)}</bdi></p>}
    <DataSelect label={c.nullBehavior} value={String(binding.nullBehavior ?? "EMPTY")} values={["EMPTY", "FALLBACK", "ERROR"]} change={value => {
      const next: DataValue = { ...binding, nullBehavior: value }; if (value !== "FALLBACK") delete next.fallback; else next.fallback ??= ""; change(next);
    }} />
    {binding.nullBehavior === "FALLBACK" && <DataInput label={c.fallback} value={String(binding.fallback ?? "")} change={value => patch("fallback", value)} />}
    {showFormat && field && <FormatEditor currencyRequest={{ kind: "BINDING", binding, rowSourcePath }} value={binding.format} allowed={field.allowedFormats} change={value => { const next = { ...binding }; if (value === undefined) delete next.format; else next.format = value; change(next); }} />}
  </div>;
}
