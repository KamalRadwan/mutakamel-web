"use client";

import { useState, useEffect } from "react";
import { CheckCircle2, Save, Info, Lock, AlertCircle } from "lucide-react";
import { SettingFieldData } from "../hooks/useSettings";
import { useToast } from "@/components/ui/ToastContext";

interface SettingFieldProps {
  setting: SettingFieldData;
  lang: string;
  onUpdate: (key: string, value: any) => Promise<void> | void;
}

export function SettingField({ setting, lang, onUpdate }: SettingFieldProps) {
  const { key, value: initialValue, descriptionI18n, uiMeta, readOnly, isSaving, lastSaved, error } = setting;
  const toast = useToast();
  
  const [localValue, setLocalValue] = useState(initialValue);
  const [localError, setLocalError] = useState<string | null>(error || null);

  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    setLocalError(error || null);
  }, [error]);

  if (!uiMeta) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 text-red-600 rounded-xl text-xs">
        Missing UI Metadata for {key}
      </div>
    );
  }

  const title = lang === "ar" ? uiMeta.titleAr : uiMeta.titleEn;

  const handleBlur = async () => {
    if (localValue !== initialValue) {
      setLocalError(null);
      try {
        await onUpdate(key, localValue);
        toast.success(
          lang === "ar" ? "تم الحفظ تلقائياً" : "Saved Automatically",
          `${title}`
        );
      } catch (err: any) {
        const errMsg = err?.message || (lang === "ar" ? "قيمة غير صالحة" : "Invalid setting value");
        setLocalError(errMsg);
        toast.error(lang === "ar" ? "فشل التحديث" : "Update Failed", errMsg);
      }
    }
  };

  const handleToggle = async () => {
    if (readOnly) return;
    setLocalError(null);
    const nextVal = !localValue;
    setLocalValue(nextVal);
    try {
      await onUpdate(key, nextVal);
      toast.success(
        lang === "ar" ? "تم الحفظ تلقائياً" : "Saved Automatically",
        `${title}`
      );
    } catch (err: any) {
      const errMsg = err?.message || (lang === "ar" ? "تعذر تحديث الإعداد" : "Update failed");
      setLocalError(errMsg);
      toast.error(lang === "ar" ? "فشل التحديث" : "Update Failed", errMsg);
    }
  };

  const handleSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (readOnly) return;
    setLocalError(null);
    const nextVal = e.target.value;
    setLocalValue(nextVal);
    try {
      await onUpdate(key, nextVal);
      toast.success(
        lang === "ar" ? "تم الحفظ تلقائياً" : "Saved Automatically",
        `${title}`
      );
    } catch (err: any) {
      const errMsg = err?.message || (lang === "ar" ? "تعذر تحديث الإعداد" : "Update failed");
      setLocalError(errMsg);
      toast.error(lang === "ar" ? "فشل التحديث" : "Update Failed", errMsg);
    }
  };

  return (
    <div className={`p-5 rounded-2xl border transition-colors ${readOnly ? "bg-slate-50 dark:bg-slate-800/30 border-slate-200 dark:border-slate-800" : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-200 dark:hover:border-blue-800/50"} shadow-2xs group`}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        
        {/* Left Side: Label and Description */}
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              {title}
              {readOnly && <Lock className="w-3.5 h-3.5 text-slate-400" />}
            </h3>
          </div>
          
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl flex items-start gap-1.5 mt-1.5">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            {lang === "ar" ? descriptionI18n.ar : descriptionI18n.en}
          </p>

          {readOnly && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-2 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded w-fit">
              {lang === "ar" ? "هذا الإعداد يُدار عبر بيئة التشغيل ومقفل للتعديل." : "Managed by environment configuration and is read-only."}
            </p>
          )}

          {localError && (
            <p className="text-[11px] text-red-600 dark:text-red-400 font-medium mt-2 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded w-fit flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {localError}
            </p>
          )}
        </div>

        {/* Right Side: Input and Save Indicator */}
        <div className="w-full sm:w-64 shrink-0 flex flex-col items-end gap-2">
          <div className="w-full relative">
            
            {uiMeta.inputType === "boolean" && (
              <div className="flex items-center justify-end h-9">
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
                value={localValue || ""}
                onChange={(e) => setLocalValue(e.target.value)}
                onBlur={handleBlur}
                disabled={readOnly}
                placeholder={uiMeta.placeholder}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed font-mono"
              />
            )}

            {uiMeta.inputType === "number" && (
              <input
                type="number"
                value={localValue ?? ""}
                onChange={(e) => setLocalValue(e.target.value === "" ? "" : Number(e.target.value))}
                onBlur={handleBlur}
                disabled={readOnly}
                min={uiMeta.min}
                max={uiMeta.max}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors disabled:opacity-70 disabled:cursor-not-allowed font-mono"
              />
            )}

            {uiMeta.inputType === "enum" && (
              <select
                value={localValue || ""}
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

          {/* Feedback States */}
          <div className="h-5 flex items-center justify-end text-[11px] font-medium transition-opacity w-full">
            {isSaving ? (
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 animate-pulse">
                <Save className="w-3.5 h-3.5" />
                {lang === "ar" ? "جاري الحفظ..." : "Saving..."}
              </span>
            ) : lastSaved ? (
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {lang === "ar" ? "تم الحفظ تلقائياً" : "Saved"}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
