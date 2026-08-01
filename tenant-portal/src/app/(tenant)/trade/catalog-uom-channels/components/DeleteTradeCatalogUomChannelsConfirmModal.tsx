"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CatalogUomChannelItem } from "../hooks/useTradeCatalogUomChannels";

interface DeleteModalProps {
  isOpen: boolean;
  item: CatalogUomChannelItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeCatalogUomChannelsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف العنصر المرجعي"
      message={`هل أنت تأكد من حذف "${item?.name || ""}" (${item?.code || ""})؟`}
      confirmText="حذف العنصر"
      isDanger
    />
  );
}
