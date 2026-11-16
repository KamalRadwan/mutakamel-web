"use client";
import { Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
import { useDataCopy, useDataInput, useDataNumber } from "./hooks/useDataControls";
import { useDataEditingDisabled } from "./data-editing-context";

export function DataInput({ label, value, change, hint }: { label: string; value: string; change(value: string): void; hint?: string }) {
  return <Field label={label} showLabel hint={hint}><Input disabled={useDataEditingDisabled()} value={value} onChange={useDataInput(change)} /></Field>;
}
export function DataNumber({ label, value, change }: { label: string; value: number | undefined; change(value: number): void }) {
  return <Field label={label} showLabel><Input disabled={useDataEditingDisabled()} type="number" value={value ?? ""} onChange={useDataNumber(change)} /></Field>;
}
export function DataSelect({ label, value, values, change, disabled = false }: { label: string; value: string; values: readonly string[]; change(value: string): void; disabled?: boolean }) {
  const c = useDataCopy();
  const inheritedDisabled = useDataEditingDisabled();
  return <Field label={label} showLabel><Select value={value} onValueChange={change} disabled={disabled || inheritedDisabled}>
    <SelectTrigger><SelectValue placeholder={label} /></SelectTrigger><SelectContent>{values.map(key => <SelectItem key={key} value={key}>{c.status[key as keyof typeof c.status] ?? key}</SelectItem>)}</SelectContent>
  </Select></Field>;
}
