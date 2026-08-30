"use client";

import { Save, Info, Lock, RefreshCw } from "lucide-react";
import {
  AmbiguousOutcomePanel,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/design-system";
import { localSettingsError, SettingFieldData } from "../hooks/useSettings";
import { useToast } from "@/components/ui/ToastContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";

const KNOWN_SETTING_ERROR_CODES = [
  "SETTINGS_CRITICAL_PERMISSION_REQUIRED",
  "SETTING_NOT_LOADED",
  "PENDING_SETTING_WRITE_MUST_BE_RECONCILED",
];

interface SettingFieldProps {
  setting: SettingFieldData;
  lang: string;
  onUpdate: (
    key: string,
    value: string | number | boolean,
  ) => Promise<void> | void;
  onReload: (key: string) => Promise<void> | void;
  onRetryExact: () => Promise<void> | void;
}

export function SettingField({ setting, lang, onUpdate, onReload, onRetryExact }: SettingFieldProps) {
  const toast = useToast();
  const copy = (lang === "ar" ? ar : en).settings.field;
  const {
    key,
    value: initialValue,
    descriptionI18n,
    uiMeta,
    readOnly,
    isSaving,
    permissionLocked,
    isRefreshing,
    hasPendingChange,
  } = setting;

  const localValue = initialValue;

  if (!uiMeta) {
    return (
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive-subtle p-4 text-xs text-destructive-subtle-foreground">
        Missing UI Metadata for {key}
      </div>
    );
  }

  const title = lang === "ar" ? uiMeta.titleAr : uiMeta.titleEn;
  const fieldId = `setting-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const titleId = `${fieldId}-title`;
  const descriptionId = `${fieldId}-description`;
  const readOnlyReasonId = readOnly ? `${fieldId}-read-only-reason` : undefined;
  const describedBy = [descriptionId, readOnlyReasonId].filter(Boolean).join(" ");

  const handleChange = async (newVal: string | number | boolean) => {
    if (readOnly) return;
    try {
      await onUpdate(key, newVal);
    } catch (err: unknown) {
      toast.error(
        copy.invalidValueTitle,
        errorText(err, lang) || copy.valueSaveFailed,
      );
    }
  };

  const handleToggle = () => {
    handleChange(!localValue);
  };

  return (
    <div className={`rounded-lg border p-5 transition-colors motion-reduce:transition-none ${readOnly ? "border-border bg-muted" : "border-border bg-card hover:border-primary/30"} group`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

        {/* Left Side: Label and Description */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-foreground">
              {title}
              {readOnly && <Lock className="size-3.5 text-muted-foreground" aria-hidden="true" />}
            </h3>
          </div>

          <p id={descriptionId} className="mt-1.5 flex max-w-2xl items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {lang === "ar" ? descriptionI18n.ar : descriptionI18n.en}
          </p>

          {readOnly && (
            <p id={readOnlyReasonId} className="mt-2 w-fit rounded bg-warning-subtle px-2 py-1 text-xs font-medium text-warning-subtle-foreground">
              {permissionLocked ? copy.permissionLockedNote : copy.environmentLockedNote}
            </p>
          )}

        </div>

        {/* Right Side: Input and Save Button */}
        <div className="w-full sm:w-72 shrink-0 flex flex-col items-end gap-2">
          <div className="w-full flex items-center gap-2">
            <div className="flex-1">
              {uiMeta.inputType === "boolean" && (
                <div className="flex h-9 items-center justify-start">
                  <Switch
                    id={fieldId}
                    aria-labelledby={titleId}
                    aria-describedby={describedBy}
                    checked={Boolean(localValue)}
                    onCheckedChange={handleToggle}
                    disabled={readOnly}
                  />
                </div>
              )}

              {uiMeta.inputType === "string" && (
                <Input
                  id={fieldId}
                  aria-labelledby={titleId}
                  aria-describedby={describedBy}
                  type="text"
                  value={
                    typeof localValue === "string"
                      ? localValue
                      : String(localValue ?? "")
                  }
                  onChange={(e) => handleChange(e.target.value)}
                  disabled={readOnly}
                  placeholder={uiMeta.placeholder}
                  className="w-full font-mono"
                />
              )}

              {uiMeta.inputType === "number" && (
                <Input
                  id={fieldId}
                  aria-labelledby={titleId}
                  aria-describedby={describedBy}
                  type="number"
                  value={
                    typeof localValue === "number" ? localValue : ""
                  }
                  onChange={(e) => handleChange(e.target.value === "" ? "" : Number(e.target.value))}
                  disabled={readOnly}
                  min={uiMeta.min}
                  max={uiMeta.max}
                  className="w-full font-mono"
                />
              )}

              {uiMeta.inputType === "enum" && (
                <Select
                  value={
                    typeof localValue === "boolean"
                      ? ""
                      : String(localValue ?? "")
                  }
                  onValueChange={handleChange}
                  disabled={readOnly}
                >
                  <SelectTrigger id={fieldId} aria-labelledby={titleId} aria-describedby={describedBy} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {uiMeta.options?.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {lang === "ar" && opt.labelAr ? opt.labelAr : opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Feedback States */}
          <div className="flex min-h-6 w-full items-center justify-end text-xs font-medium">
            {isSaving ? (
              <span className="flex items-center gap-1.5 text-primary" role="status">
                <Save className="size-3.5 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
                {copy.saving}
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => {
                  void Promise.resolve(onReload(key)).catch(() => undefined);
                }}
                disabled={isRefreshing || hasPendingChange}
                title={hasPendingChange ? copy.reloadDisabledHint : copy.reloadHint}
                className="h-auto px-1.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw
                  className={`size-3.5 ${isRefreshing ? "animate-spin motion-reduce:animate-none" : ""}`}
                  aria-hidden="true"
                />
                {copy.reload}
              </Button>
            )}
          </div>
          {setting.ambiguous ? (
            <AmbiguousOutcomePanel
              className="w-full"
              idempotencyKey={setting.idempotencyKey}
              correlationId={setting.correlationId}
              message={setting.error ?? undefined}
              onRetryExact={() =>
                void Promise.resolve(onRetryExact()).catch(() => undefined)
              }
              retrying={isSaving}
            />
          ) : setting.error ? (
            <p role="alert" className="w-full text-start text-xs text-destructive-subtle-foreground">
              {setting.error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function errorText(error: unknown, lang: string) {
  if (!(error instanceof Error)) return "";
  if (KNOWN_SETTING_ERROR_CODES.includes(error.message)) {
    return localSettingsError(lang === "ar" ? "ar" : "en", error.message);
  }
  return error.message;
}
