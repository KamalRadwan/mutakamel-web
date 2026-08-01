"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { HostStatusItem } from "../hooks/useHostStatus";

interface DeleteModalProps {
  isOpen: boolean;
  item: HostStatusItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteHostStatusConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="إزالة وتفكيك النطاق"
      message={`هل أنت تأكد من إزالة وتفكيك ربط النطاق ${item?.fqdn || ""}؟ قد يؤدي هذا إلى انقطاع الوصول.`}
      confirmText="إزالة النطاق فوراً"
      isDanger
    />
  );
}
