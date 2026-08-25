"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useI18n } from "@/i18n/I18nContext";
import type { LeadStageItem } from "../lead-stage-contract";

interface DeleteModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  item: LeadStageItem | null;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteLeadStagesConfirmModal({
  isOpen,
  isSubmitting,
  item,
  error,
  onClose,
  onConfirm,
}: DeleteModalProps) {
  const { t, lang } = useI18n();
  const name = item ? (lang === "ar" ? item.nameAr : item.nameEn) : "";

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={lang === "ar" ? "حذف مرحلة العميل" : "Delete lead stage"}
      message={
        lang === "ar"
          ? `هل تريد حذف مرحلة «${name}»؟ قد يرفض الخادم الحذف إذا كانت مستخدمة.`
          : `Delete “${name}”? The server will reject deletion if the stage is in use.`
      }
      confirmText={t.common.delete}
      loadingText={lang === "ar" ? "جارٍ الحذف..." : "Deleting..."}
      isSubmitting={isSubmitting}
      error={error}
      closeOnConfirm={false}
      isDanger
    />
  );
}
