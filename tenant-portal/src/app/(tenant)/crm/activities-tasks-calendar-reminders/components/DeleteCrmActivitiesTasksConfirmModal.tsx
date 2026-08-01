"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CrmTaskItem } from "../hooks/useCrmActivitiesTasks";

interface DeleteModalProps {
  isOpen: boolean;
  item: CrmTaskItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmActivitiesTasksConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف المهمة والتذكير"
      message={`هل أنت تأكد من إلغاء المهمة "${item?.subject || ""}"؟`}
      confirmText="حذف المهمة"
      isDanger
    />
  );
}
