"use client";
import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { EMPTY_PERIOD_FORM, type PeriodFormValues } from "../../inventory-governance-contract";

function validDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function usePeriodForm(onSubmit: (values: PeriodFormValues) => Promise<boolean>, initialValues = EMPTY_PERIOD_FORM) {
  const { t } = useI18n();
  const [values, setValues] = useState<PeriodFormValues>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof PeriodFormValues, string>>>({});
  const set = (patch: Partial<PeriodFormValues>) => setValues((current) => ({ ...current, ...patch }));
  const reset = () => { setValues(EMPTY_PERIOD_FORM); setErrors({}); };
  const submit = async () => {
    const next: typeof errors = {};
    if (!/^[A-Z][A-Z0-9_.-]{1,39}$/u.test(values.code.trim().toUpperCase())) next.code = t.tradeInventory.formCodeInvalid;
    if (!validDate(values.startsOn)) next.startsOn = t.tradeInventory.formDateInvalid;
    if (!validDate(values.endsOn) || values.endsOn < values.startsOn) next.endsOn = t.tradeInventory.formDateInvalid;
    if (!/^\d+$/u.test(values.maxBackdateDays) || Number(values.maxBackdateDays) > 366) next.maxBackdateDays = t.tradeInventory.formBackdateInvalid;
    setErrors(next);
    if (Object.keys(next).length === 0 && await onSubmit(values)) reset();
  };
  return { values, errors, set, reset, submit, isDirty: JSON.stringify(values) !== JSON.stringify(EMPTY_PERIOD_FORM) };
}
