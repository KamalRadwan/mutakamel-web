"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CustomerProfileItem } from "../hooks/useCustomerProfiles";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: CustomerProfileItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCustomerProfilesConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteTheClientFile}
      message={`هل أنت تأكد من حذف ملف العميل "${item?.name || ""}"؟`}
      confirmText={t.crm.deleteClient}
      isDanger
    />
  );
}
