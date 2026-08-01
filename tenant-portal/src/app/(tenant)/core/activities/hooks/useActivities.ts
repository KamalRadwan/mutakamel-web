"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface ActivityItem {
  id: string;
  title: string;
  activityType: string;
  assignee: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  status: "open" | "completed" | "cancelled";
}

const mockActivities: ActivityItem[] = [
  { id: "act-1", title: "متابعة العميل المحتمل شركة الأمل", activityType: "اتصال هاتفي", assignee: "منى علي", dueDate: "2026-07-26", priority: "high", status: "open" },
  { id: "act-2", title: "إرسال عرض أسعار المعدات الطبية", activityType: "بريد إلكتروني", assignee: "أحمد محمود", dueDate: "2026-07-27", priority: "medium", status: "open" },
  { id: "act-3", title: "اجتماع مراجعة العقد السنوي", activityType: "اجتماع حضوري", assignee: "سارة حسن", dueDate: "2026-07-24", priority: "low", status: "completed" },
];

export function useActivities() {
  const { t } = useI18n();
  const [items, setItems] = useState<ActivityItem[]>(mockActivities);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<ActivityItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.assignee.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<ActivityItem, "id" | "status">) => {
    const created: ActivityItem = {
      ...newItem,
      id: `act-${Date.now().toString().slice(-4)}`,
      status: "open",
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
