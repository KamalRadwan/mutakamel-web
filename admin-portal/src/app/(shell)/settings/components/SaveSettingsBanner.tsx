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
    <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-4 rounded-xl shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 animate-in slide-in-from-top-2 fade-in duration-300">
      <div className="flex items-center gap-3 text-blue-800 dark:text-blue-300">
        <AlertCircle className="w-5 h-5 shrink-0" />
        <p className="text-sm font-semibold">
          {lang === "ar" ? "لديك تغييرات غير محفوظة." : "You have unsaved changes."}
        </p>
      </div>
      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving}
        className="w-full sm:w-auto px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-600/20 transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
      >
        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {lang === "ar" ? "حفظ التغييرات" : "Save Changes"}
      </button>
    </div>
  );
}
