"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface TemplateItem {
  id: string;
  name: string;
  category: "email" | "pdf" | "html";
  version: string;
  status: "published" | "draft" | "archived";
  updatedAt: string;
}

const mockTemplates: TemplateItem[] = [
  { id: "tmpl-101", name: "قالب الفاتورة الإلكترونية الموحدة", category: "pdf", version: "v1.4.0", status: "published", updatedAt: "2026-07-22" },
  { id: "tmpl-102", name: "قالب البريد الترحيبي بالعميل الجديد", category: "email", version: "v2.0.1", status: "published", updatedAt: "2026-07-24" },
  { id: "tmpl-103", name: "قالب عرض الأسعار والخدمات الطبية", category: "html", version: "v0.9.0", status: "draft", updatedAt: "2026-07-25" },
];

export function useTemplatePlatform() {
  const { t } = useI18n();
  const [items, setItems] = useState<TemplateItem[]>(mockTemplates);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<TemplateItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<TemplateItem, "id" | "version" | "status" | "updatedAt">) => {
    const created: TemplateItem = {
      ...newItem,
      id: `tmpl-${Date.now().toString().slice(-4)}`,
      version: "v1.0.0",
      status: "draft",
      updatedAt: "2026-07-25",
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
