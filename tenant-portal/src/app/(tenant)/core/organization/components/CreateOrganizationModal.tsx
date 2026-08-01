"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; unitType: "company" | "branch" | "department" | "team"; parentUnit: string; code: string; manager: string }) => void;
}

export function CreateOrganizationModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [name, setName] = useState("");
  const [unitType, setUnitType] = useState<"company" | "branch" | "department" | "team">("branch");
  const [parentUnit, setParentUnit] = useState("شركة متكامل كراود كابيتال القابضة");
  const [code, setCode] = useState(`ORG-${Math.floor(10 + Math.random() * 90)}`);
  const [manager, setManager] = useState("منى علي");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, unitType, parentUnit, code, manager });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة وحدة تنظيمية جديدة (شركة/فرع/قسم/فريق)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم الوحدة التنظيمية" placeholder="مثال: فرع جدة" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="نوع الوحدة"
            value={unitType}
            onChange={(e) => setUnitType(e.target.value as any)}
            options={[
              { label: "شركة (Company)", value: "company" },
              { label: "فرع (Branch)", value: "branch" },
              { label: "قسم (Department)", value: "department" },
              { label: "فريق عمل (Team)", value: "team" },
            ]}
          />
          <Input label="كود الوحدة" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <Input label="الوحدة المتبوعة (Parent Unit)" value={parentUnit} onChange={(e) => setParentUnit(e.target.value)} required />
        <Input label="المدير المسؤول" value={manager} onChange={(e) => setManager(e.target.value)} required />
        
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">إضافة الوحدة</Button>
        </div>
      </form>
    </Modal>
  );
}
