"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useI18n } from "@/i18n/I18nContext";
import type { AcquisitionSource } from "../acquisition-source-contract";

interface DeleteModalProps {
  isOpen: boolean;
  item: AcquisitionSource | null;
  onClose: () => void;
  onConfirm: () => void;
  isSubmitting: boolean;
  error: string | null;
}

export function DeleteAcquisitionSourcesConfirmModal({
  isOpen,
  item,
  onClose,
  onConfirm,
  isSubmitting,
  error,
}: DeleteModalProps) {
  const { lang } = useI18n();
  const name = lang === "ar" ? item?.nameAr : item?.nameEn;
  const copy =
    lang === "ar"
      ? {
          title: "حذف مصدر الاستقطاب",
          message: `هل تريد حذف مصدر الاستقطاب «${name ?? ""}»؟ قد يرفض CRM الحذف إذا كان المصدر مستخدمًا.`,
          confirm: "حذف المصدر",
          loading: "جارٍ الحذف...",
        }
      : {
          title: "Delete acquisition source",
          message: `Delete “${name ?? ""}”? CRM will reject deletion when the source is in use.`,
          confirm: "Delete source",
          loading: "Deleting...",
        };

  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={copy.title}
      message={error ? `${copy.message} ${error}` : copy.message}
      confirmText={copy.confirm}
      loadingText={copy.loading}
      isSubmitting={isSubmitting}
      closeOnConfirm={false}
      isDanger
    />
  );
}
