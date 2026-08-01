"use client";

import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { TradeWidgetCatalogItem } from "../hooks/useTradeDashboardWidgets";

interface DeleteModalProps {
  isOpen: boolean;
  item: TradeWidgetCatalogItem | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTradeDashboardWidgetsConfirmModal({ isOpen, item, onClose, onConfirm }: DeleteModalProps) {
  return (
    <ConfirmModal
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={onConfirm}
      title="حذف الويدجت التجارية"
      message={`هل أنت تأكد من إزالة الويدجت "${item?.widgetName || ""}" من كتالوج التجارة؟`}
      confirmText="حذف الويدجت"
      isDanger
    />
  );
}
