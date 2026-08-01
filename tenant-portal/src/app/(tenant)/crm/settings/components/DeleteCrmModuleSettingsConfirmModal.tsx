"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CrmModuleSettingItem } from "../hooks/useCrmModuleSettings";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: CrmModuleSettingItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmModuleSettingsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteAndResetTheSetting}
      message={`هل أنت تأكد من إزالة وتصفير الإعداد "${item?.settingName || ""}" (${item?.key || ""})؟`}
      confirmText={t.crm.removeSetting}
      isDanger
    />
  );
}
