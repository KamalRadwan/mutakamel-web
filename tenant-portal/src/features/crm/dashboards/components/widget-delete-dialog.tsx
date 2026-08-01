"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import type { CrmDashboardWidget } from "../models/dashboard-types";
import { useState } from "react";

interface WidgetDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widget: CrmDashboardWidget | null;
  onConfirm: (widgetId: string) => Promise<void>;
}

export function WidgetDeleteDialog({ open, onOpenChange, widget, onConfirm }: WidgetDeleteDialogProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const [isDeleting, setIsDeleting] = useState(false);

  if (!widget) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await onConfirm(widget.id);
      onOpenChange(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const title = isRtl ? "حذف التطبيق المصغر" : "Delete Widget";

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} title={title}>
      <div dir={isRtl ? "rtl" : "ltr"}>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {isRtl 
            ? `هل أنت متأكد من رغبتك في حذف "${widget.name}"؟ لا يمكن التراجع عن هذا الإجراء وسيتم إزالة التطبيق من جميع لوحات القيادة التي تستخدمه.` 
            : `Are you sure you want to delete "${widget.name}"? This action cannot be undone and it will be removed from all dashboards that use it.`}
        </p>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            {isRtl ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
            {isDeleting ? (isRtl ? "جاري الحذف..." : "Deleting...") : (isRtl ? "نعم، احذف" : "Yes, Delete")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
