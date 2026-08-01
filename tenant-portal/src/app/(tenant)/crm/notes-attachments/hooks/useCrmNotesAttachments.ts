"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface NoteAttachmentItem {
  id: string;
  title: string;
  targetType: "lead" | "deal" | "customer";
  targetName: string;
  noteContent: string;
  attachmentName: string;
  fileSize: string;
  createdBy: string;
  createdAt: string;
}

const mockNotes: NoteAttachmentItem[] = [
  { id: "note-101", title: "ملاحظات الاجتماع الأخير وعرض الأسعار الفني", targetType: "deal", targetName: "صفقة مستشفى الحياة", noteContent: "تم الاتفاق على تقديم خصم 5% مقابل السداد المباشر", attachmentName: "Technical_Proposal_v2.pdf", fileSize: "2.4 MB", createdBy: "أحمد محمود", createdAt: "2026-07-22" },
  { id: "note-102", title: "السجل التجاري والشهادات الضريبية للعميل", targetType: "customer", targetName: "شركة الأمل للتوريدات", noteContent: "مرفق السجل التجاري المحدث الصادر من وزارة التجارة", attachmentName: "Commercial_CR_2026.pdf", fileSize: "1.1 MB", createdBy: "منى علي", createdAt: "2026-07-24" },
];

export function useCrmNotesAttachments() {
  const { t } = useI18n();
  const [items, setItems] = useState<NoteAttachmentItem[]>(mockNotes);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<NoteAttachmentItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.targetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.attachmentName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<NoteAttachmentItem, "id" | "createdAt">) => {
    const created: NoteAttachmentItem = {
      ...newItem,
      id: `note-${Date.now().toString().slice(-4)}`,
      createdAt: "2026-07-25",
    };
    setItems((prev) => [...prev, created]);
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
