"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { StaticCatalogueItem } from "../hooks/useCrmStaticCatalogue";

interface DeleteModalProps {
  isOpen: boolean;
  item: StaticCatalogueItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmStaticCatalogueConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف الكتالوج المرجعي"
      message={`هل أنت تأكد من حذف الكتالوج المرجعي "${item?.catalogName || ""}"؟`}
      confirmText="حذف الكتالوج"
      isDanger
    />
  );
}
