"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { UserModuleAssignmentItem } from "../hooks/useUserModuleAssignments";

interface DeleteModalProps {
  isOpen: boolean;
  item: UserModuleAssignmentItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteUserModuleAssignmentsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="سحب الموديول من المستخدم"
      message={`هل أنت تأكد من سحب موديول "${item?.moduleName || ""}" من المستخدم "${item?.userName || ""}"؟`}
      confirmText="سحب الموديول"
      isDanger
    />
  );
}
