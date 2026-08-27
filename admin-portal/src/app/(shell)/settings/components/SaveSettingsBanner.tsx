"use client";

import { Save, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/components/ui/ToastContext";

interface SaveSettingsBannerProps {
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onSave: () => Promise<void>;
  lang: string;
}

export function SaveSettingsBanner({ hasUnsavedChanges, isSaving, onSave, lang }: SaveSettingsBannerProps) {
  useToast();

  const handleSave = async () => {
    try {
      await onSave();
    } catch {
      // Errors are handled and toasted centrally inside the hook
    }
  };

  if (!hasUnsavedChanges && !isSaving) return null;

  return (
    <div className="bg-warn-50 dark:bg-warn-950/20 border border-warn-200 dark:border-warn-800/50 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="flex items-center gap-3 text-warn-800 dark:text-warn-300">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-semibold">
          {lang === "ar" ? "لديك تغييرات غير محفوظة." : "You have unsaved changes."}
        </p>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="w-full sm:w-auto px-4 py-2 text-sm font-semibold bg-brand-500 hover:bg-brand-600 text-ink-950 dark:bg-brand-400 dark:hover:bg-brand-500 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {lang === "ar" ? "حفظ التغييرات" : "Save Changes"}
      </button>
    </div>
  );
}
