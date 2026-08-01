"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nContext";

export interface CrmTaskItem {
  id: string;
  subject: string;
  leadOrCustomer: string;
  taskType: "call" | "meeting" | "demo" | "reminder";
  dueDate: string;
  reminderStatus: "scheduled" | "sent" | "dismissed";
  status: "pending" | "done";
}

const mockCrmTasks: CrmTaskItem[] = [
  { id: "task-101", subject: "جلسة عرض تقديمي (Demo) لنظام إدارة المخزون", leadOrCustomer: "شركة الأمل للتوريدات الطبية", taskType: "demo", dueDate: "2026-07-28 11:00", reminderStatus: "scheduled", status: "pending" },
  { id: "task-102", subject: "تذكير الهاتفي لمتابعة مسودة العقد", leadOrCustomer: "الدكتور خالد بن عبد العزيز", taskType: "call", dueDate: "2026-07-26 15:30", reminderStatus: "scheduled", status: "pending" },
  { id: "task-103", subject: "اجتماع مفاوضة الأسعار النهائي", leadOrCustomer: "مؤسسة الأفق", taskType: "meeting", dueDate: "2026-07-24 10:00", reminderStatus: "sent", status: "done" },
];

export function useCrmActivitiesTasks() {
  const { t } = useI18n();
  const [items, setItems] = useState<CrmTaskItem[]>(mockCrmTasks);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedForDelete, setSelectedForDelete] = useState<CrmTaskItem | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.leadOrCustomer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = (newItem: Omit<CrmTaskItem, "id" | "reminderStatus" | "status">) => {
    const created: CrmTaskItem = {
      ...newItem,
      id: `task-${Date.now().toString().slice(-4)}`,
      reminderStatus: "scheduled",
      status: "pending",
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
