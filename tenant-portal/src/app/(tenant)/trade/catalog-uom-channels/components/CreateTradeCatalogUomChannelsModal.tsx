"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; type: "catalog" | "uom" | "channel"; code: string; conversionFactor?: string }) => void;
}

export function CreateTradeCatalogUomChannelsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"catalog" | "uom" | "channel">("uom");
  const [code, setCode] = useState("");
  const [conversionFactor, setConversionFactor] = useState("1");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    onSubmit({ name, type, code, conversionFactor });
    setName("");
    setCode("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة وحدة قياس / كتالوج / قناة بيع" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="النوع Type"
          value={type}
          onChange={(e) => setType(e.target.value as any)}
          options={[
            { label: "وحدة قياس (Unit of Measure)", value: "uom" },
            { label: "كتالوج منتجات (Catalog)", value: "catalog" },
            { label: "قناة بيع (Sales Channel)", value: "channel" },
          ]}
        />
        <Input label="الاسم / التعريف" placeholder="مثال: طرد سعة 12 قطة" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="الكود Code" placeholder="PACK12" value={code} onChange={(e) => setCode(e.target.value)} required />
        {type === "uom" && (
          <Input label="معامل التحويل Conversion Factor" type="number" value={conversionFactor} onChange={(e) => setConversionFactor(e.target.value)} required />
        )}
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الإدخال</Button>
        </div>
      </form>
    </Modal>
  );
}
