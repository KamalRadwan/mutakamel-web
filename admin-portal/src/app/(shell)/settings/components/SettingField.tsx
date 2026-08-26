"use client";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Save, Info, Lock, Loader2, RefreshCw } from "lucide-react";
import { SettingFieldData } from "../hooks/useSettings";
import { useToast } from "@/components/ui/ToastContext";

interface SettingFieldProps {
  setting: SettingFieldData;
  lang: string;
  onUpdate: (
    key: string,
    value: string | number | boolean,
  ) => Promise<void> | void;
  onReload: (key: string) => Promise<void> | void;
}

export function SettingField({ setting, lang, onUpdate, onReload }: SettingFieldProps) {
  const toast = useToast();
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
      <div className="p-4 border border-red-200 bg-red-50 text-red-600 rounded-xl text-xs">
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
        lang === "ar" ? "قيمة غير صالحة" : "Invalid Value",
        errorText(err) || (lang === "ar" ? "تعذر حفظ القيمة." : "The value could not be saved."),
      );
    }
  };

  const handleToggle = () => {
    handleChange(!localValue);
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    handleChange(e.target.value);
  };

  return (
    <div className={`p-5 rounded-xl border transition-colors ${readOnly ? "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800/50"} shadow-2xs group`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">

        {/* Left Side: Label and Description */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {title}
              {readOnly && <Lock className="w-3.5 h-3.5 text-slate-400" />}
            </h3>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl flex items-start gap-1.5 mt-1.5">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            {lang === "ar" ? descriptionI18n.ar : descriptionI18n.en}
          </p>

          {readOnly && (
            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-2 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded w-fit">
              {permissionLocked
                ? lang === "ar"
                  ? "يتطلب التعديل صلاحيتَي admin.settings.update و admin.settings.critical معاً."
                  : "Editing requires both admin.settings.update and admin.settings.critical."
                : lang === "ar"
                  ? "هذا الإعداد يُدار عبر بيئة التشغيل ومقفل للتعديل."
                  : "Managed by environment configuration and is read-only."}
            </p>
          )}

        </div>

        {/* Right Side: Input and Save Button */}
        <div className="w-full sm:w-72 shrink-0 flex flex-col items-end gap-2">
          <div className="w-full flex items-center gap-2">
            <div className="flex-1">
              {uiMeta.inputType === "boolean" && (
                <div className="flex items-center justify-start h-9">
                  <button
                    type="button"
                    onClick={handleToggle}
                    disabled={readOnly}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${localValue ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"} ${readOnly ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${localValue ? "translate-x-6" : "translate-x-1"}`} />
                  </button>
                </div>
              )}

              {uiMeta.inputType === "string" && (
                <input
                  type="text"
                  value={
                    typeof localValue === "string"
                      ? localValue
                      : String(localValue ?? "")
                  }
                  onChange={(e) => handleChange(e.target.value)}
                  disabled={readOnly}
                  placeholder={uiMeta.placeholder}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed font-mono"
                />
              )}

              {uiMeta.inputType === "number" && (
                <input
                  type="number"
                  value={
                    typeof localValue === "number" ? localValue : ""
                  }
                  onChange={(e) => handleChange(e.target.value === "" ? "" : Number(e.target.value))}
                  disabled={readOnly}
                  min={uiMeta.min}
                  max={uiMeta.max}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed font-mono"
                />
              )}

              {uiMeta.inputType === "enum" && (
                <select
                  value={
                    typeof localValue === "boolean"
                      ? ""
                      : localValue || ""
                  }
                  onChange={handleSelectChange}
                  disabled={readOnly}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
                >
                  {uiMeta.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {lang === "ar" && opt.labelAr ? opt.labelAr : opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Feedback States */}
          <div className="h-5 flex items-center justify-end text-xs font-medium transition-opacity w-full">
            {isSaving ? (
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 animate-pulse">
                <Save className="w-3.5 h-3.5" />
                {lang === "ar" ? "جاري الحفظ..." : "Saving..."}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void Promise.resolve(onReload(key)).catch(() => undefined);
                }}
                disabled={isRefreshing || hasPendingChange}
                title={
                  hasPendingChange
                    ? lang === "ar"
                      ? "احفظ التغيير قبل إعادة تحميل القيمة الموثوقة."
                      : "Save the edit before reloading the authoritative value."
                    : lang === "ar"
                      ? "إعادة تحميل هذا الإعداد من Core"
                      : "Reload this setting from Core"
                }
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-slate-400 dark:hover:text-blue-300"
              >
                <RefreshCw
                  className={`size-3.5 ${isRefreshing ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {lang === "ar" ? "إعادة تحميل" : "Reload"}
              </button>
            )}
          </div>
          {setting.error ? (
            <p role="alert" className="w-full text-start text-xs text-rose-700 dark:text-rose-300">
              {setting.error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "";
}
