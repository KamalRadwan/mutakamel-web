"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { BusinessLetterItem } from "../hooks/useBusinessLetters";

interface DeleteModalProps {
  isOpen: boolean;
  item: BusinessLetterItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteBusinessLettersConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف وإلغاء الخطاب الرسمي"
      message={`هل أنت تأكد من إلغاء وحذف الخطاب "${item?.subject || ""}" الموجه إلى "${item?.recipient || ""}"؟`}
      confirmText="حذف الخطاب"
      isDanger
    />
  );
}
