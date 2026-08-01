"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; code: string; layoutGrid: string }) => void;
}

export function CreateTradeDashboardBuilderModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("trade_custom_board");
  const [layoutGrid, setLayoutGrid] = useState("3x2 Grid Responsive");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, code, layoutGrid });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إنشاء لوحة مؤشرات تجارية جديدة" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم اللوحة" placeholder="مثال: لوحة حركة الشحنات اليومية" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="الكود البرمجي Code" value={code} onChange={(e) => setCode(e.target.value)} required />
        <Select
          label="تنسيق الشبكة Layout Grid"
          value={layoutGrid}
          onChange={(e) => setLayoutGrid(e.target.value)}
          options={[
            { label: "3x2 Grid Responsive (موصى به)", value: "3x2 Grid Responsive" },
            { label: "2x2 Grid Standard", value: "2x2 Grid Standard" },
            { label: "Full Width Canvas", value: "Full Width Canvas" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ اللوحة</Button>
        </div>
      </form>
    </Modal>
  );
}
