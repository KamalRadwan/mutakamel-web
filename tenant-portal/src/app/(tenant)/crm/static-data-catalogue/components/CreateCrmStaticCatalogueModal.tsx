"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { catalogName: string; category: "lead_sources" | "industry_types" | "deal_reasons" | "currencies" }) => void;
}

export function CreateCrmStaticCatalogueModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [catalogName, setCatalogName] = useState("");
  const [category, setCategory] = useState<"lead_sources" | "industry_types" | "deal_reasons" | "currencies">("industry_types");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogName) return;
    onSubmit({ catalogName, category });
    setCatalogName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة كتالوج بيانات ثابتة لموديول CRM" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم الكتالوج / القائمة المرجعية" placeholder="مثال: دليل الأنشطة الطبية والدوائية" value={catalogName} onChange={(e) => setCatalogName(e.target.value)} required />
        <Select
          label="التصنيف المرجعي"
          value={category}
          onChange={(e) => setCategory(e.target.value as any)}
          options={[
            { label: "أنواع القطاعات (Industry Types)", value: "industry_types" },
            { label: "أسباب الخسارة (Deal Lost Reasons)", value: "deal_reasons" },
            { label: "مصادر الاستقطاب (Lead Sources)", value: "lead_sources" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الكتالوج</Button>
        </div>
      </form>
    </Modal>
  );
}
