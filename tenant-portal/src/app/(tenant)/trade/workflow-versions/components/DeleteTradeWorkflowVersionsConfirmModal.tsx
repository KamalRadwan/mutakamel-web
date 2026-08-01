"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { WorkflowVersionItem } from "../hooks/useTradeWorkflowVersions";

interface DeleteModalProps {
  isOpen: boolean;
  item: WorkflowVersionItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeWorkflowVersionsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="أرشفة وإلغاء إصدار سير العمل"
      message={`هل أنت تأكد من أرشفة إصدار سير العمل "${item?.workflowName || ""}" (${item?.versionNumber || ""})؟`}
      confirmText="أرشفة الإصدار"
      isDanger
    />
  );
}
