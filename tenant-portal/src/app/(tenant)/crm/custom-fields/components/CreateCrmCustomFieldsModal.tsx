"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { label: string; key: string; targetEntity: "lead" | "deal" | "contact" | "organization"; fieldType: "text" | "number" | "select" | "date"; isRequired: boolean }) => void;
}

export function CreateCrmCustomFieldsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [targetEntity, setTargetEntity] = useState<"lead" | "deal" | "contact" | "organization">("lead");
  const [fieldType, setFieldType] = useState<"text" | "number" | "select" | "date">("text");
  const [isRequired, setIsRequired] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !key) return;
    onSubmit({ label, key, targetEntity, fieldType, isRequired });
    setLabel("");
    setKey("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة حقل مخصص جديد (Custom Field)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="عنوان الحقل" placeholder="مثال: رقم الرخصة التجارية" value={label} onChange={(e) => setLabel(e.target.value)} required />
        <Input label="مفتاح الحقل البرمجي (Key)" placeholder="commercial_license_no" value={key} onChange={(e) => setKey(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="الكيان المستهدف"
            value={targetEntity}
            onChange={(e) => setTargetEntity(e.target.value as any)}
            options={[
              { label: "عميل محتمل (Lead)", value: "lead" },
              { label: "صفقة تجارية (Deal)", value: "deal" },
              { label: "جهة اتصال (Contact)", value: "contact" },
              { label: "منظمة (Organization)", value: "organization" },
            ]}
          />
          <Select
            label="نوع الحقل"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as any)}
            options={[
              { label: "نص (Text)", value: "text" },
              { label: "رقم (Number)", value: "number" },
              { label: "قائمة اختيار (Select)", value: "select" },
              { label: "تاريخ (Date)", value: "date" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="req"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="req" className="text-xs text-slate-700 dark:text-slate-300">حقل إجباري (Required)</label>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الحقل</Button>
        </div>
      </form>
    </Modal>
  );
}
