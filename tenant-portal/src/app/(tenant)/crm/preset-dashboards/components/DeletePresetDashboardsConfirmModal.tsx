"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PresetDashboardItem } from "../hooks/usePresetDashboards";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: PresetDashboardItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeletePresetDashboardsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deletePresetPanel}
      message={`هل أنت تأكد من حذف اللوحة المسبقة "${item?.name || ""}"؟`}
      confirmText={t.crm.deleteThePanel}
      isDanger
    />
  );
}
