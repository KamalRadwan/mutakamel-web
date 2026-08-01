"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { DocumentProfileItem } from "../hooks/useTradeDocumentProfile";

interface DeleteModalProps {
  isOpen: boolean;
  item: DocumentProfileItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeDocumentProfileConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف بروفايل المستندات"
      message={`هل أنت تأكد من حذف البروفايل المستندي "${item?.profileName || ""}"؟`}
      confirmText="حذف البروفايل"
      isDanger
    />
  );
}
