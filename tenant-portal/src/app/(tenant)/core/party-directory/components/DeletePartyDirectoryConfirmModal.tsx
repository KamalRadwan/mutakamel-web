"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PartyItem } from "../hooks/usePartyDirectory";

interface DeleteModalProps {
  isOpen: boolean;
  item: PartyItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeletePartyDirectoryConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف الجهة من دفتر العناوين"
      message={`هل أنت تأكد من حذف الجهة "${item?.name || ""}"؟`}
      confirmText="حذف الجهة"
      isDanger
    />
  );
}
