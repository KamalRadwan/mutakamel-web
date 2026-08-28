"use client";

import { Save, Info, Lock, RefreshCw } from "lucide-react";
import {
  AmbiguousOutcomePanel,
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
      <div className="p-4 border border-danger-200 bg-danger-50 text-danger-600 rounded-lg text-xs">
        Missing UI Metadata for {key}
      </div>
    );
  }

  const title = lang === "ar" ? uiMeta.titleAr : uiMeta.titleEn;

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
    <div className={`p-5 rounded-lg border transition-colors ${readOnly ? "bg-ink-100 dark:bg-ink-800/30 border-border" : "bg-card border-border hover:border-brand-200 dark:hover:border-brand-800/50"} group`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

        {/* Left Side: Label and Description */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              {title}
              {readOnly && <Lock className="w-3.5 h-3.5 text-muted-foreground" />}
            </h3>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl flex items-start gap-1.5 mt-1.5">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            {lang === "ar" ? descriptionI18n.ar : descriptionI18n.en}
          </p>

          {readOnly && (
            <p className="text-xs text-warn-700 dark:text-warn-400 font-medium mt-2 bg-warn-50 dark:bg-warn-950/20 px-2 py-1 rounded w-fit">
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
                    checked={Boolean(localValue)}
                    onCheckedChange={handleToggle}
                    disabled={readOnly}
                  />
                </div>
              )}

              {uiMeta.inputType === "string" && (
                <Input
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
                  <SelectTrigger className="w-full">
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
          <div className="h-5 flex items-center justify-end text-xs font-medium transition-opacity w-full">
            {isSaving ? (
              <span className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 animate-pulse">
                <Save className="w-3.5 h-3.5" />
                {copy.saving}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void Promise.resolve(onReload(key)).catch(() => undefined);
                }}
                disabled={isRefreshing || hasPendingChange}
                title={hasPendingChange ? copy.reloadDisabledHint : copy.reloadHint}
                className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:text-brand-300"
              >
                <RefreshCw
                  className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {copy.reload}
              </button>
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
            <p role="alert" className="w-full text-start text-xs text-danger-700 dark:text-danger-300">
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
