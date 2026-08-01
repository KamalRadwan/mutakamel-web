"use client";

import { useI18n } from "@/i18n/I18nContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Copy } from "lucide-react";
import type { CrmDashboardWidget } from "../models/dashboard-types";
import { useState } from "react";

interface WidgetDuplicateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widget: CrmDashboardWidget | null;
  onConfirm: (widgetId: string) => Promise<void>;
}

export function WidgetDuplicateDialog({ open, onOpenChange, widget, onConfirm }: WidgetDuplicateDialogProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const [isDuplicating, setIsDuplicating] = useState(false);

  if (!widget) return null;

  const handleDuplicate = async () => {
    try {
      setIsDuplicating(true);
      await onConfirm(widget.id);
      onOpenChange(false);
    } finally {
      setIsDuplicating(false);
    }
  };

  const title = isRtl ? "نسخ التطبيق المصغر" : "Duplicate Widget";

  return (
    <Modal isOpen={open} onClose={() => onOpenChange(false)} title={title}>
      <div dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full text-blue-600 dark:text-blue-400">
            <Copy className="w-6 h-6" />
          </div>
          <p>
            {isRtl 
              ? `هل تريد إنشاء نسخة مطابقة من "${widget.name}"؟ سيتم إضافتها إلى لوحة القيادة الحالية ويمكنك تعديلها لاحقاً.` 
              : `Do you want to create an exact copy of "${widget.name}"? It will be added to the current dashboard and you can modify it later.`}
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isDuplicating}>
            {isRtl ? "إلغاء" : "Cancel"}
          </Button>
          <Button type="button" onClick={handleDuplicate} disabled={isDuplicating} className="bg-blue-600 hover:bg-blue-700 text-white">
            {isDuplicating ? (isRtl ? "جاري النسخ..." : "Duplicating...") : (isRtl ? "تأكيد النسخ" : "Yes, Duplicate")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
