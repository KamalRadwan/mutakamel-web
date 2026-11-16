"use client";
import { Field, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/design-system";
interface Props { label: string; value: string; options: ReadonlyArray<{ value: string; label: string; disabled?: boolean }>; onChange: (value: string) => void; disabled?: boolean; hint?: string; placeholder?: string; error?: string; }
export function WidgetSelect({ label, value, options, onChange, disabled, hint, placeholder, error }: Props) {
  return <Field showLabel label={label} hint={hint} error={error}><Select value={value} disabled={disabled} onValueChange={onChange}>
    <SelectTrigger size="sm"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>
      {options.map((option) => <SelectItem key={option.value} value={option.value} disabled={option.disabled}>{option.label}</SelectItem>)}
    </SelectContent></Select></Field>;
}
