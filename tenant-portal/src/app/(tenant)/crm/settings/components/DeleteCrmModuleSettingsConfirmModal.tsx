"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CrmModuleSettingItem } from "../hooks/useCrmModuleSettings";

interface DeleteModalProps {
  isOpen: boolean;
  item: CrmModuleSettingItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmModuleSettingsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف وإعادة ضبط الإعداد"
      message={`هل أنت تأكد من إزالة وتصفير الإعداد "${item?.settingName || ""}" (${item?.key || ""})؟`}
      confirmText="إزالة الإعداد"
      isDanger
    />
  );
}
