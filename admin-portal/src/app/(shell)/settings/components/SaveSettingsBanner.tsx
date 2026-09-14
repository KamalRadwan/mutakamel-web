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
    <div className="mb-3 flex flex-col items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning-subtle p-3 text-warning-subtle-foreground sm:flex-row">
      <div className="flex items-center gap-2">
        <AlertCircle className="size-4 shrink-0" />
        <p className="text-xs font-semibold">
          {copy.unsavedChanges}
        </p>
      </div>
      <Button
        type="button"
        variant="primary"
        size="sm"
        onClick={handleSave}
        loading={isSaving}
        className="w-full sm:w-auto"
      >
        {!isSaving && <Save className="size-3.5" />}
        {copy.saveChanges}
      </Button>
    </div>
  );
}
