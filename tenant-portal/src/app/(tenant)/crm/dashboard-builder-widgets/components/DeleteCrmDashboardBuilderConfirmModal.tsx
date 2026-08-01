"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { WidgetItem } from "../hooks/useCrmDashboardBuilder";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: WidgetItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmDashboardBuilderConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteAndHideTheWidget}
      message={`هل أنت تأكد من إزالة الـ Widget "${item?.name || ""}" من لوحة المؤشرات؟`}
      confirmText={t.crm.removeTheWidget}
      isDanger
    />
  );
}
