"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { LeadItem } from "../hooks/useLeads";
import { useI18n } from "@/i18n/I18nContext";

interface DeleteModalProps {
  isOpen: boolean;
  item: LeadItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteLeadsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
    const { t, lang } = useI18n();
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title={t.crm.deleteTheLead}
      message={lang === "ar" ? `هل أنت متأكد من حذف العميل المحتمل "${item?.leadName || ""}" (${item?.company || ""})؟` : `Are you sure you want to delete the lead "${item?.leadName || ""}" (${item?.company || ""})?`}
      confirmText={t.crm.deleteClient}
      isDanger
    />
  );
}
