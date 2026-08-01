"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ApiDocItem } from "../hooks/useCrmApiDocs";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: ApiDocItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmApiDocsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteAPIDocumentation}
      message={`هل أنت تأكد من حذف توثيق API "${item?.title || ""}"؟`}
      confirmText={t.crm.deleteDocumentation}
      isDanger
    />
  );
}
