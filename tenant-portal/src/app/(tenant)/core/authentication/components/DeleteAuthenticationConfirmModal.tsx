"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { AuthSessionItem } from "../hooks/useAuthenticationManagement";

interface DeleteModalProps {
  isOpen: boolean;
  item: AuthSessionItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAuthenticationConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="إنهاء وإلغاء الجلسة"
      message={`هل أنت تأكد من إلغاء الجلسة الخاصة بالبريد الإلكتروني ${item?.userEmail || ""}؟`}
      confirmText="إنهاء الجلسة فوراً"
      isDanger
    />
  );
}
