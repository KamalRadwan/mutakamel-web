"use client";

import { Save, AlertCircle } from "lucide-react";
import { Button } from "@/design-system";
import { useToast } from "@/components/ui/ToastContext";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";

interface SaveSettingsBannerProps {
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  onSave: () => Promise<void>;
  lang: string;
}

export function SaveSettingsBanner({ hasUnsavedChanges, isSaving, onSave, lang }: SaveSettingsBannerProps) {
  useToast();
  const copy = (lang === "ar" ? ar : en).settings.banner;

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
          {copy.unsavedChanges}
        </p>
      </div>
      <Button
        type="button"
        variant="primary"
        onClick={handleSave}
        loading={isSaving}
        className="w-full sm:w-auto"
      >
        {!isSaving && <Save className="w-4 h-4" />}
        {copy.saveChanges}
      </Button>
    </div>
  );
}
