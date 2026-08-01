"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; activityType: string; assignee: string; dueDate: string; priority: "high" | "medium" | "low" }) => void;
}

export function CreateActivitiesModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [title, setTitle] = useState("");
  const [activityType, setActivityType] = useState("اتصال هاتفي");
  const [assignee, setAssignee] = useState("منى علي");
  const [dueDate, setDueDate] = useState("2026-07-30");
  const [priority, setPriority] = useState<"high" | "medium" | "low">("medium");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    onSubmit({ title, activityType, assignee, dueDate, priority });
    setTitle("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة نشاط / مهمة جديدة" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="عنوان النشاط" placeholder="مثال: اتصال متابعة للعميل" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="نوع النشاط"
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            options={[
              { label: "اتصال هاتفي", value: "اتصال هاتفي" },
              { label: "بريد إلكتروني", value: "بريد إلكتروني" },
              { label: "اجتماع حضوري", value: "اجتماع حضوري" },
              { label: "مهمة إدارية", value: "مهمة إدارية" },
            ]}
          />
          <Select
            label="المسؤول"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            options={[
              { label: "منى علي", value: "منى علي" },
              { label: "أحمد محمود", value: "أحمد محمود" },
              { label: "سارة حسن", value: "سارة حسن" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="تاريخ الاستحقاق" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
          <Select
            label="الأولويات"
            value={priority}
            onChange={(e) => setPriority(e.target.value as "high" | "medium" | "low")}
            options={[
              { label: "عالية (High)", value: "high" },
              { label: "متوسطة (Medium)", value: "medium" },
              { label: "منخفضة (Low)", value: "low" },
            ]}
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ المهمة</Button>
        </div>
      </form>
    </Modal>
  );
}
