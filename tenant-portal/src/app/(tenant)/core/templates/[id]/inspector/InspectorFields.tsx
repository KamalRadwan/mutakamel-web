"use client";
import { Checkbox, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/design-system";
import { useInspectorInput, useInspectorNumber, useInspectorToggle } from "./useInspectorForm";
import { useInspectorPorts } from "./useInspectorPorts";

export function InspectorText({ label, value, onValue, multiline, maxLength = 200 }: { label: string; value: unknown; onValue: (value: string) => void; multiline?: boolean; maxLength?: number }) {
  const change = useInspectorInput(onValue);
  const { disabled } = useInspectorPorts();
  return <Field label={label} showLabel>{multiline ? <Textarea disabled={disabled} value={String(value ?? "")} maxLength={maxLength} onChange={change} /> : <Input disabled={disabled} value={String(value ?? "")} maxLength={maxLength} onChange={change} />}</Field>;
}
export function InspectorNumber({ label, value, onValue, min, max, step = 0.01 }: { label: string; value: unknown; onValue: (value: number) => void; min: number; max: number; step?: number }) {
  const change = useInspectorNumber(onValue);
  const { disabled } = useInspectorPorts();
  return <Field label={label} showLabel><Input disabled={disabled} type="number" value={typeof value === "number" && Number.isFinite(value) ? value : ""} onChange={change} min={min} max={max} step={step} required /></Field>;
}
export function InspectorSelect({ label, value, options, onValue, disabled = false }: { label: string; value: unknown; options: readonly { value: string; label: string; disabled?: boolean }[]; onValue: (value: string) => void; disabled?: boolean }) {
  const ports = useInspectorPorts();
  return <Field label={label} showLabel><Select disabled={disabled || ports.disabled} value={String(value ?? "")} onValueChange={onValue}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}</SelectContent></Select></Field>;
}
export function InspectorCheck({ label, value, onValue }: { label: string; value: unknown; onValue: (value: boolean) => void }) {
  const change = useInspectorToggle(onValue);
  const { disabled } = useInspectorPorts();
  return <label className="flex min-h-8 items-center gap-2 text-sm"><Checkbox disabled={disabled} checked={value === "indeterminate" ? "indeterminate" : value === true} onCheckedChange={change} />{label}</label>;
}
