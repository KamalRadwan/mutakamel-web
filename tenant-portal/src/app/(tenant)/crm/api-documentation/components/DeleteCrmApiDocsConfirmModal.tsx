"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ApiDocItem } from "../hooks/useCrmApiDocs";

interface DeleteModalProps {
  isOpen: boolean;
  item: ApiDocItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmApiDocsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف توثيق الـ API"
      message={`هل أنت تأكد من حذف توثيق API "${item?.title || ""}"؟`}
      confirmText="حذف التوثيق"
      isDanger
    />
  );
}
