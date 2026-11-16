"use client";
import { Field, Input } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { SerialKeysField } from "./SerialKeysField";
import type { MovementFieldErrors } from "../movement-form-validation";

interface TrackingValues { quantity: string; lotKey?: string; serialKeys?: string; expiresAt?: string }
export function MovementTrackingFields({ mode, values, onChange, disabled, expiry = false, errors = {} }: {
  mode: "NONE" | "LOT" | "SERIAL" | null; values: TrackingValues;
  onChange: (patch: Partial<TrackingValues>) => void; disabled: boolean; expiry?: boolean;
  errors?: MovementFieldErrors;
}) {
  const { t } = useI18n();
  if (mode === "NONE" || mode === null) return null;
  return <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-2">
    {mode === "LOT" ? <Field label={t.tradeInventory.lotKey} showLabel required error={errors.lotKey}>
      <Input value={values.lotKey ?? ""} maxLength={120} disabled={disabled} onChange={event => onChange({ lotKey: event.target.value })} />
    </Field> : <SerialKeysField value={values.serialKeys ?? ""} quantity={values.quantity} disabled={disabled} required error={errors.serialKeys} onChange={serialKeys => onChange({ serialKeys })} />}
    {expiry && <Field label={t.tradeInventory.trackingExpiryDate} showLabel error={errors.expiresAt}>
      <Input type="date" value={values.expiresAt ?? ""} disabled={disabled} onChange={event => onChange({ expiresAt: event.target.value })} />
    </Field>}
  </div>;
}
