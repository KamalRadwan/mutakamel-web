"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { CrmTaskItem } from "../hooks/useCrmActivitiesTasks";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: CrmTaskItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteCrmActivitiesTasksConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteTaskAndReminder}
      message={`هل أنت تأكد من إلغاء المهمة "${item?.subject || ""}"؟`}
      confirmText={t.crm.deleteTheTask}
      isDanger
    />
  );
}
