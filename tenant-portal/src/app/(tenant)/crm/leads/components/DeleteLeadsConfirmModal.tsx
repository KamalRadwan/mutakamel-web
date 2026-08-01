"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LeadItem } from "../hooks/useLeads";

interface DeleteModalProps {
  isOpen: boolean;
  item: LeadItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteLeadsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف العميل المحتمل"
      message={`هل أنت تأكد من حذف العميل المحتمل "${item?.leadName || ""}" (${item?.company || ""})؟`}
      confirmText="حذف العميل"
      isDanger
    />
  );
}
