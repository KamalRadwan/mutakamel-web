"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { UserItem } from "../hooks/useUsers";

interface DeleteModalProps {
  isOpen: boolean;
  item: UserItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteUsersConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف وتعطيل المستخدم"
      message={`هل أنت تأكد من حذف وتعطيل حساب المستخدم "${item?.fullName || ""}" (${item?.email || ""})؟`}
      confirmText="تعطيل الحساب"
      isDanger
    />
  );
}
