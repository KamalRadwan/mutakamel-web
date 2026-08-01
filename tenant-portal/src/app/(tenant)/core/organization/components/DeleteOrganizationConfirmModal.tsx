"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { OrgUnitItem } from "../hooks/useOrganization";

interface DeleteModalProps {
  isOpen: boolean;
  item: OrgUnitItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteOrganizationConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف الوحدة التنظيمية"
      message={`هل أنت تأكد من حذف الوحدة التنظيمية "${item?.name || ""}"؟ قد يؤثر ذلك على التبعيات التابعة.`}
      confirmText="حذف الوحدة"
      isDanger
    />
  );
}
