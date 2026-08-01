"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { subject: string; leadOrCustomer: string; taskType: "call" | "meeting" | "demo" | "reminder"; dueDate: string }) => void;
}

export function CreateCrmActivitiesTasksModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [subject, setSubject] = useState("");
  const [leadOrCustomer, setLeadOrCustomer] = useState("شركة الأمل للتوريدات الطبية");
  const [taskType, setTaskType] = useState<"call" | "meeting" | "demo" | "reminder">("demo");
  const [dueDate, setDueDate] = useState("2026-07-29 10:00");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject) return;
    onSubmit({ subject, leadOrCustomer, taskType, dueDate });
    setSubject("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="جدولة مهمة CRM / تذكير تقويم جديد" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="موضوع المهمة" placeholder="مثال: تقديم العرض الفني" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <Input label="العميل المرتبط" value={leadOrCustomer} onChange={(e) => setLeadOrCustomer(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="نوع الفعالية"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value as any)}
            options={[
              { label: "عرض حيا (Demo)", value: "demo" },
              { label: "اتصال تلفوني (Call)", value: "call" },
              { label: "اجتماع عمل (Meeting)", value: "meeting" },
              { label: "تذكير عام (Reminder)", value: "reminder" },
            ]}
          />
          <Input label="التاريخ والوقت" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">جدولة المهمة</Button>
        </div>
      </form>
    </Modal>
  );
}
