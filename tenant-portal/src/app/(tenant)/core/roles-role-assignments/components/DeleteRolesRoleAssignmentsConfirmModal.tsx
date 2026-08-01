"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { RoleItem } from "../hooks/useRolesRoleAssignments";

interface DeleteModalProps {
  isOpen: boolean;
  item: RoleItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteRolesRoleAssignmentsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف الدور والتخصيصات"
      message={`هل أنت تأكد من حذف الدور "${item?.name || ""}"؟ سيؤدي ذلك إلى سحب الصلاحيات المنسوبة للمستخدمين.`}
      confirmText="حذف الدور"
      isDanger
    />
  );
}
