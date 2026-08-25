"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nContext";
import {
  ACQUISITION_SOURCE_NAME_MAX_LENGTH,
  type CreateAcquisitionSourceInput,
} from "../acquisition-source-contract";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateAcquisitionSourceInput) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

export function CreateAcquisitionSourcesModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: CreateModalProps) {
  const { lang } = useI18n();
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const copy =
    lang === "ar"
      ? {
          title: "إضافة مصدر استقطاب",
          nameAr: "الاسم بالعربية",
          nameEn: "الاسم بالإنجليزية",
          cancel: "إلغاء",
          save: "حفظ المصدر",
          saving: "جارٍ الحفظ...",
        }
      : {
          title: "Add acquisition source",
          nameAr: "Arabic name",
          nameEn: "English name",
          cancel: "Cancel",
          save: "Save source",
          saving: "Saving...",
        };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void (async () => {
      const saved = await onSubmit({ nameAr, nameEn });
      if (!saved) return;
      setNameAr("");
      setNameEn("");
    })();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={copy.title}
      maxWidth="md"
      closeDisabled={isSubmitting}
      closeLabel={copy.cancel}
      initialFocusSelector="[name='nameAr']"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          name="nameAr"
          dir="rtl"
          label={copy.nameAr}
          aria-label={copy.nameAr}
          value={nameAr}
          onChange={(event) => setNameAr(event.target.value)}
          maxLength={ACQUISITION_SOURCE_NAME_MAX_LENGTH}
          disabled={isSubmitting}
          required
        />
        <Input
          name="nameEn"
          dir="ltr"
          label={copy.nameEn}
          aria-label={copy.nameEn}
          value={nameEn}
          onChange={(event) => setNameEn(event.target.value)}
          maxLength={ACQUISITION_SOURCE_NAME_MAX_LENGTH}
          disabled={isSubmitting}
          required
        />
        {error && (
          <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
            {copy.cancel}
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? copy.saving : copy.save}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
