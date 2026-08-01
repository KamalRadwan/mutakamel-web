"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { scopeName: string; scopeLevel: "global" | "branch" | "warehouse" | "pos"; targetCode: string }) => void;
}

export function CreateTradeConfigurationScopeModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [scopeName, setScopeName] = useState("");
  const [scopeLevel, setScopeLevel] = useState<"global" | "branch" | "warehouse" | "pos">("branch");
  const [targetCode, setTargetCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scopeName || !targetCode) return;
    onSubmit({ scopeName, scopeLevel, targetCode });
    setScopeName("");
    setTargetCode("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة نطاق تهيئة جديد (Configuration Scope)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم نطاق التهيئة" placeholder="مثال: نطاق فرع المنطقة الشرقية" value={scopeName} onChange={(e) => setScopeName(e.target.value)} required />
        <Select
          label="مستوى النطاق Scope Level"
          value={scopeLevel}
          onChange={(e) => setScopeLevel(e.target.value as any)}
          options={[
            { label: "عام لجميع الفروع (Global)", value: "global" },
            { label: "فرع محدد (Branch)", value: "branch" },
            { label: "مستودع محدد (Warehouse)", value: "warehouse" },
            { label: "نقاط البيع (POS)", value: "pos" },
          ]}
        />
        <Input label="كود الهدف Target Code" placeholder="BR-EAST-01" value={targetCode} onChange={(e) => setTargetCode(e.target.value)} required />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ النطاق</Button>
        </div>
      </form>
    </Modal>
  );
}
