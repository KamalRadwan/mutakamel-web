"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface BusinessLetterItem {
  id: string;
  letterNumber: string;
  subject: string;
  recipient: string;
  templateType: string;
  status: "draft" | "issued" | "archived";
  createdAt: string;
}

const mockLetters: BusinessLetterItem[] = [
  { id: "let-101", letterNumber: "LTR-2026-001", subject: "خطاب عدم مانع ونقل كفالة", recipient: "وزارة الموارد البشرية", templateType: "خطاب رسمي موجه", status: "issued", createdAt: "2026-07-20" },
  { id: "let-102", letterNumber: "LTR-2026-002", subject: "شهادة تعريف بالراتب وتثبيت مستحقات", recipient: "بنك الراجحي", templateType: "شهادة راتب", status: "draft", createdAt: "2026-07-22" },
  { id: "let-103", letterNumber: "LTR-2026-003", subject: "تفويض رسمي للتعامل الجمركي", recipient: "الهيئة العامة للجمرك", templateType: "تفويض رسمي", status: "archived", createdAt: "2026-06-15" },
];

export function useBusinessLetters() {
  const { t } = useI18n();
  const [items, setItems] = useState<BusinessLetterItem[]>(mockLetters);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<BusinessLetterItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.recipient.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.letterNumber.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<BusinessLetterItem, "id" | "status" | "createdAt">) => {
    const created: BusinessLetterItem = {
      ...newItem,
      id: `let-${Date.now().toString().slice(-4)}`,
      status: "draft",
      createdAt: "2026-07-25",
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
