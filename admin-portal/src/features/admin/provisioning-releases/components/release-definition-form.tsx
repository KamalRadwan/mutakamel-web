"use client";

import { Checkbox, Field, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@/design-system";
import { RELEASE_RISK_LEVELS, type ReleaseDefinitionDraft, type ReleaseValidationErrors } from "../types/provisioning-releases";
import { ReleaseFieldError, type ReleaseCopy } from "./release-shared";

export function ReleaseDefinitionFields({
  value,
  errors,
  copy,
  onChange,
  disabled = false,
}: {
  value: ReleaseDefinitionDraft;
  errors: ReleaseValidationErrors;
  copy: ReleaseCopy;
  onChange: <K extends keyof ReleaseDefinitionDraft>(field: K, value: ReleaseDefinitionDraft[K]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-70">
      <legend className="sr-only">{copy.definition}</legend>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <TextField label={copy.componentId} value={value.componentId} error={errors.componentId} copy={copy} dir="ltr" onChange={(next) => onChange("componentId", next)} />
        <TextField label={copy.releaseVersion} value={value.releaseVersion} error={errors.releaseVersion} copy={copy} dir="ltr" maxLength={64} onChange={(next) => onChange("releaseVersion", next)} />
        <TextField label={copy.manifestVersion} value={value.manifestVersion} error={errors.manifestVersion} copy={copy} dir="ltr" inputMode="numeric" onChange={(next) => onChange("manifestVersion", next)} />
        <TextField label={copy.contractVersion} value={value.contractVersion} error={errors.contractVersion} copy={copy} dir="ltr" inputMode="numeric" onChange={(next) => onChange("contractVersion", next)} />
        <TextField label={copy.runtimeBuildSha} value={value.runtimeBuildSha} error={errors.runtimeBuildSha} copy={copy} dir="ltr" maxLength={64} onChange={(next) => onChange("runtimeBuildSha", next)} />
        <TextField label={copy.schemaTarget} value={value.schemaTarget} error={errors.schemaTarget} copy={copy} dir="ltr" maxLength={255} onChange={(next) => onChange("schemaTarget", next)} />
        <TextField label={copy.schemaChecksum} value={value.schemaChecksum} error={errors.schemaChecksum} copy={copy} dir="ltr" maxLength={64} onChange={(next) => onChange("schemaChecksum", next)} />
        <Field label={copy.riskLevel}>
          {(fieldProps) => (
            <Select value={value.riskLevel} onValueChange={(next) => onChange("riskLevel", next as ReleaseDefinitionDraft["riskLevel"])}>
              <SelectTrigger id={fieldProps.id}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELEASE_RISK_LEVELS.map((risk) => (
                  <SelectItem key={risk} value={risk}>{risk}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Field>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <JsonField label={copy.manifestPayload} value={value.manifestPayload} error={errors.manifestPayload} copy={copy} onChange={(next) => onChange("manifestPayload", next)} />
        <JsonField label={copy.compatibility} value={value.compatibility} error={errors.compatibility} copy={copy} onChange={(next) => onChange("compatibility", next)} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <BooleanField label={copy.selfServiceAllowed} checked={value.selfServiceAllowed} onChange={(next) => onChange("selfServiceAllowed", next)} />
        <BooleanField label={copy.requiresBackup} checked={value.requiresBackup} onChange={(next) => onChange("requiresBackup", next)} />
        <BooleanField label={copy.requiresMaintenance} checked={value.requiresMaintenance} onChange={(next) => onChange("requiresMaintenance", next)} />
      </div>
    </fieldset>
  );
}

function TextField({
  label,
  value,
  onChange,
  copy,
  error,
  dir,
  inputMode,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  copy: ReleaseCopy;
  error?: ReleaseValidationErrors[string];
  dir?: "ltr";
  inputMode?: "numeric";
  maxLength?: number;
}) {
  return (
    <Field label={label}>
      {(fieldProps) => {
        const errorId = `${fieldProps.id}-error`;
        return (
          <div className="space-y-1.5">
            <Input
              id={fieldProps.id}
              aria-describedby={error ? errorId : undefined}
              value={value}
              dir={dir}
              inputMode={inputMode}
              maxLength={maxLength}
              invalid={Boolean(error)}
              onChange={(event) => onChange(event.target.value)}
            />
            <ReleaseFieldError id={errorId} code={error} copy={copy} />
          </div>
        );
      }}
    </Field>
  );
}

function JsonField({
  label,
  value,
  onChange,
  copy,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  copy: ReleaseCopy;
  error?: ReleaseValidationErrors[string];
}) {
  return (
    <Field label={label}>
      {(fieldProps) => {
        const errorId = `${fieldProps.id}-error`;
        return (
          <div className="space-y-1.5">
            <Textarea
              id={fieldProps.id}
              aria-describedby={error ? errorId : undefined}
              value={value}
              dir="ltr"
              spellCheck={false}
              rows={16}
              invalid={Boolean(error)}
              onChange={(event) => onChange(event.target.value)}
              className="min-h-72 resize-y bg-ink-950 font-mono text-xs font-normal leading-5 text-ink-100"
            />
            <ReleaseFieldError id={errorId} code={error} copy={copy} />
          </div>
        );
      }}
    </Field>
  );
}

function BooleanField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-ink-100 px-3 text-sm font-semibold text-foreground dark:bg-ink-900">
      <Checkbox checked={checked} onCheckedChange={(next) => onChange(next === true)} />
      <span>{label}</span>
    </label>
  );
}
