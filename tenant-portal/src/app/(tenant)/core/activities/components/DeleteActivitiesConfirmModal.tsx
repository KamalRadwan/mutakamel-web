"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ActivityItem } from "../hooks/useActivities";

interface DeleteModalProps {
  isOpen: boolean;
  item: ActivityItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteActivitiesConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف المهمة / النشاط"
      message={`هل أنت تأكد من حذف النشاط "${item?.title || ""}"؟`}
      confirmText="حذف النهائي"
      isDanger
    />
  );
}
