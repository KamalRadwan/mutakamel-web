"use client";

import { Save } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { Button, Checkbox, Field, Input } from "@/design-system";
import type {
  DatabaseServerProvisioningPrincipalBindingView,
  UpdateDatabaseServerSystemPrincipalRotationDto,
} from "../types";
import { useSystemPrincipalRotationEditor } from "../hooks/useSystemPrincipalRotationEditor";

interface Props {
  binding: DatabaseServerProvisioningPrincipalBindingView;
  canUpdate: boolean;
  onSave: (dto: UpdateDatabaseServerSystemPrincipalRotationDto) => Promise<unknown>;
}

export function SystemPrincipalRotationPolicy({ binding, canUpdate, onSave }: Props) {
  const { lang, t } = useI18n();
  const copy = t.databaseServerDetail.readiness.rotationPolicy;
  const editor = useSystemPrincipalRotationEditor(binding, onSave, {
    invalidInterval: lang === "ar" ? "يجب أن يكون فاصل التدوير بين 24 و8760 ساعة." : "Rotation interval must be between 24 and 8760 hours.",
    invalidReason: lang === "ar" ? "أدخل سببًا لا يقل عن 8 أحرف." : "Enter a reason of at least 8 characters.",
    updateFailed: lang === "ar" ? "تعذر تحديث سياسة التدوير." : "Policy update failed.",
  });

  const disabled = !canUpdate || editor.pending;

  return (
    <form
      className="mt-4 space-y-4 border-t border-border pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        void editor.submit();
      }}
    >
      <div className="flex min-h-(--size-control-lg) items-center gap-3">
        <Checkbox
          id="system-principal-auto-rotation"
          checked={editor.enabled}
          onCheckedChange={(checked) => editor.setEnabled(checked === true)}
          disabled={disabled}
        />
        <label htmlFor="system-principal-auto-rotation" className="text-sm font-semibold text-foreground">
          {copy.automaticRotation}
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={copy.intervalHours} required>
          {(fieldProps) => <Input {...fieldProps} type="number" min={24} max={8760} value={editor.intervalHours} onChange={(event) => editor.setIntervalHours(Number(event.target.value))} disabled={disabled} />}
        </Field>
        <Field label={copy.windowStartUtc} required>
          {(fieldProps) => <Input {...fieldProps} type="number" min={0} max={23} value={editor.windowStart} onChange={(event) => editor.setWindowStart(Number(event.target.value))} disabled={disabled} />}
        </Field>
        <Field label={copy.windowHours} required>
          {(fieldProps) => <Input {...fieldProps} type="number" min={1} max={24} value={editor.windowHours} onChange={(event) => editor.setWindowHours(Number(event.target.value))} disabled={disabled} />}
        </Field>
      </div>

      {canUpdate && (
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Field
            label={copy.reasonPlaceholder}
            hint={lang === "ar" ? `${editor.reason.trim().length}/500 · 8 أحرف على الأقل` : `${editor.reason.trim().length}/500 · minimum 8 characters`}
          >
            {(fieldProps) => <Input {...fieldProps} value={editor.reason} onChange={(event) => editor.setReason(event.target.value)} maxLength={500} disabled={editor.pending} />}
          </Field>
          <Button type="submit" variant="primary" loading={editor.pending} disabled={editor.reason.trim().length < 8}>
            <Save className="size-4" aria-hidden="true" />
            {copy.savePolicy}
          </Button>
        </div>
      )}
      {editor.error && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive-subtle px-3 py-2 text-xs font-semibold text-destructive-subtle-foreground">
          {editor.error}
        </p>
      )}
    </form>
  );
}
