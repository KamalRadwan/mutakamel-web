"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { StaticCatalogueItem } from "../hooks/useCrmStaticCatalogue";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: StaticCatalogueItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmStaticCatalogueConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteTheReferenceCatalog}
      message={`هل أنت تأكد من حذف الكتالوج المرجعي "${item?.catalogName || ""}"؟`}
      confirmText={t.crm.deleteTheCatalog}
      isDanger
    />
  );
}
