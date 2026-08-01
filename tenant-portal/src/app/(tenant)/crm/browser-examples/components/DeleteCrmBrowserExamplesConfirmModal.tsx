"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BrowserExampleItem } from "../hooks/useCrmBrowserExamples";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: BrowserExampleItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmBrowserExamplesConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteTheRecallForm}
      message={`هل أنت تأكد من حذف نموذج المتصفح "${item?.name || ""}"؟`}
      confirmText={t.crm.deleteTheForm}
      isDanger
    />
  );
}
