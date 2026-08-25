"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; category: "email" | "pdf" | "html" }) => void;
}

export function CreateTemplatePlatformModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"email" | "pdf" | "html">("pdf");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, category });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إنشاء قالب جديد في المنصة" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم القالب" placeholder="مثال: قالب الفاتورة الموحدة" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select
          label="تصنيف القالب"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          options={[
            { label: "مستند طباعة (PDF)", value: "pdf" },
            { label: "رسالة بريدية (Email)", value: "email" },
            { label: "واجهة وب (HTML)", value: "html" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">إنشاء المسودة</Button>
        </div>
      </form>
    </Modal>
  );
}
