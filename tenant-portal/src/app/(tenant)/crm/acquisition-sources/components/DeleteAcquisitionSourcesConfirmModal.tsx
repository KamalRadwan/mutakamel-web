"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AcquisitionSourceItem } from "../hooks/useAcquisitionSources";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: AcquisitionSourceItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAcquisitionSourcesConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteThePolarizationSource}
      message={`هل أنت تأكد من حذف مصدر الاستقطاب "${item?.name || ""}"؟`}
      confirmText={t.crm.deleteSource}
      isDanger
    />
  );
}
