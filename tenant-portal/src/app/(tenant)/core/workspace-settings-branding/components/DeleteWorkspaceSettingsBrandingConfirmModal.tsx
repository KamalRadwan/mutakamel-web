"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { WorkspaceProfileItem } from "../hooks/useWorkspaceSettingsBranding";

interface DeleteModalProps {
  isOpen: boolean;
  item: WorkspaceProfileItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteWorkspaceSettingsBrandingConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف وإلغاء هوية مساحة العمل"
      message={`هل أنت تأكد من إلغاء هوية مساحة العمل "${item?.tenantName || ""}"؟`}
      confirmText="حذف الهوية"
      isDanger
    />
  );
}
