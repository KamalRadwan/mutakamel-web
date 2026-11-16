"use client";

import { Badge, Button, Field } from "@/design-system";
import { localizedValue } from "@/lib/format/localized";
import type { CustomFieldItem } from "../custom-field-contract";
import type { CustomFieldRecordValuesState } from "./CustomFieldValuesPanel";
import { CustomFieldRecordValueInput } from "./CustomFieldRecordValueInput";

export function CustomFieldValueRow({ field, state }: { field: CustomFieldItem; state: CustomFieldRecordValuesState }) {
  const name = localizedValue(field.nameAr, field.nameEn, state.lang);
  const required = state.isRequired(field);
  return <li className="grid items-start gap-3 py-3 sm:grid-cols-12">
    <div className="flex flex-col gap-1 sm:col-span-3" aria-hidden="true">
      <span className="text-xs font-medium">{name}{required && <span className="text-destructive"> *</span>}</span>
      <span className="text-badge text-muted-foreground">{state.t.crmCustomFields.fieldTypes[field.type]}</span>
    </div>
    <Field label={name} required={required} readOnly={!state.canEdit} error={state.errorFor(field)}
      hint={field.type === "DATETIME" ? state.t.crmCustomFields.valueDateTimeHelp : undefined} className="sm:col-span-6">
      <CustomFieldRecordValueInput field={field} value={state.valueFor(field.id)} disabled={state.values.isSaving}
        readOnly={!state.canEdit} onChange={(next) => state.change(field.id, next)} />
    </Field>
    {state.canEdit && <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-3">
      {state.hasDraft(field.id) && <Badge tone="caution">{state.t.crmCustomFields.valueDraft}</Badge>}
      <Button size="sm" variant="ghost" disabled={!state.canClear(field)} onClick={() => state.change(field.id, null)}
        aria-label={`${state.t.crmCustomFields.valueClear}: ${name}`}>{state.t.crmCustomFields.valueClear}</Button>
      <Button size="sm" variant="outline" loading={state.values.savingFieldId === field.id} disabled={!state.canSave(field)}
        aria-label={`${state.t.common.save}: ${name}`} onClick={() => void state.save(field)}>
        {state.values.savingFieldId === field.id ? state.t.crmCustomFields.valueSaving : state.t.common.save}
      </Button>
    </div>}
  </li>;
}

