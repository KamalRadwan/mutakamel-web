"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CustomFieldItem } from "../hooks/useCrmCustomFields";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: CustomFieldItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmCustomFieldsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteTheCustomField}
      message={`هل أنت تأكد من حذف الحقل المخصص "${item?.label || ""}" (${item?.key || ""})؟`}
      confirmText={t.crm.deleteField}
      isDanger
    />
  );
}
