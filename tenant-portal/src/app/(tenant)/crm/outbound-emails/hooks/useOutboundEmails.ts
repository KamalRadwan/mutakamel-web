"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface OutboundEmailItem {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  templateUsed: string;
  sentAt: string;
  deliveryStatus: "delivered" | "opened" | "failed" | "queued";
}

const mockEmails: OutboundEmailItem[] = [
  { id: "eml-101", recipientEmail: "info@alamal-med.com", recipientName: "د. فهد عبد العزيز", subject: "تأكيد موعد العرض الفني وحزمة التراخيص", templateUsed: "tmpl-102 (الترحيب والمواعيد)", sentAt: "2026-07-25 09:30", deliveryStatus: "opened" },
  { id: "eml-102", recipientEmail: "muneer@alofok.com", recipientName: "المهندس منير الشمري", subject: "مسودة العقد النهائي والاشتراك السنوي", templateUsed: "tmpl-101 (الفاتورة والعقد)", sentAt: "2026-07-24 14:15", deliveryStatus: "delivered" },
];

export function useOutboundEmails() {
  const { t } = useI18n();
  const [items, setItems] = useState<OutboundEmailItem[]>(mockEmails);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<OutboundEmailItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.recipientEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.recipientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<OutboundEmailItem, "id" | "sentAt" | "deliveryStatus">) => {
    const created: OutboundEmailItem = {
      ...newItem,
      id: `eml-${Date.now().toString().slice(-4)}`,
      sentAt: "الآن",
      deliveryStatus: "queued",
    };
    setItems((prev) => [created, ...prev]);
    setIsCreateOpen(false);
  };

  const handleDelete = () => {
    if (selectedForDelete) {
      setItems((prev) => prev.filter((i) => i.id !== selectedForDelete.id));
      setSelectedForDelete(null);
    }
  };

  return {
    t,
    items: filteredItems,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
  };
}
