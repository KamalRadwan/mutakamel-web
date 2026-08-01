"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; category: "executive" | "sales_rep" | "marketing" | "operations" }) => void;
}

export function CreatePresetDashboardsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"executive" | "sales_rep" | "marketing" | "operations">("executive");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, category });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إنشاء لوحة مؤشرات مسبقة التجهيز (Preset Dashboard)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم اللوحة المسبقة" placeholder="مثال: لوحة كبار مدراء التسويق" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select
          label="تصنيف المستهدفين"
          value={category}
          onChange={(e) => setCategory(e.target.value as any)}
          options={[
            { label: "الإدارة التنفيذية (Executive)", value: "executive" },
            { label: "مندوبي المبيعات (Sales Rep)", value: "sales_rep" },
            { label: "التسويق والاستقطاب (Marketing)", value: "marketing" },
            { label: "العمليات والدعم (Operations)", value: "operations" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">إنشاء اللوحة</Button>
        </div>
      </form>
    </Modal>
  );
}
