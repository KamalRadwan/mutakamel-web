"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ExtensionProfileItem } from "../hooks/useTradeExtensionProfiles";

interface DeleteModalProps {
  isOpen: boolean;
  item: ExtensionProfileItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeExtensionProfilesConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف وإلغاء تفعيل الملحق"
      message={`هل أنت تأكد من إزالة الملحق التوسعي "${item?.extensionName || ""}" (${item?.pluginId || ""})؟`}
      confirmText="إزالة الملحق"
      isDanger
    />
  );
}
