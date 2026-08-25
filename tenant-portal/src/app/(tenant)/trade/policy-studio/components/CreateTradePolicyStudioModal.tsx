"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { policyName: string; policyType: "pricing_rule" | "approval_workflow" | "credit_guard" | "inventory_reservation"; targetModule: string; priorityOrder: number; conditionExpression: string }) => void;
}

export function CreateTradePolicyStudioModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [policyName, setPolicyName] = useState("");
  const [policyType, setPolicyType] = useState<"pricing_rule" | "approval_workflow" | "credit_guard" | "inventory_reservation">("pricing_rule");
  const [targetModule, setTargetModule] = useState("sales-orders");
  const [priorityOrder, setPriorityOrder] = useState(1);
  const [conditionExpression, setConditionExpression] = useState("order.quantity > 50");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!policyName) return;
    onSubmit({ policyName, policyType, targetModule, priorityOrder: Number(priorityOrder), conditionExpression });
    setPolicyName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إنشاء سياسة وقاعدة أعمال (Trade Policy Rule)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم السياسة والقاعدة" placeholder="مثال: موافقة المدير عند تتجاوز الكمية 500" value={policyName} onChange={(e) => setPolicyName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="نوع السياسة Policy Type"
            value={policyType}
            onChange={(e) => setPolicyType(e.target.value as typeof policyType)}
            options={[
              { label: "قواعد التسعير (Pricing Rule)", value: "pricing_rule" },
              { label: "مسار الموافقات (Approval Workflow)", value: "approval_workflow" },
              { label: "حماية الائتمان (Credit Guard)", value: "credit_guard" },
              { label: "حجز المخزون (Inventory Reservation)", value: "inventory_reservation" },
            ]}
          />
          <Input label="أولوية التطبيق Order" type="number" value={priorityOrder} onChange={(e) => setPriorityOrder(Number(e.target.value))} required />
        </div>
        <Input label="الموديل المستهدف" value={targetModule} onChange={(e) => setTargetModule(e.target.value)} required />
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">تعبير الشرط البرمجي Condition Expression</label>
          <textarea
            rows={2}
            value={conditionExpression}
            onChange={(e) => setConditionExpression(e.target.value)}
            className="w-full p-2.5 font-mono text-xs bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl"
            required
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ السياسة</Button>
        </div>
      </form>
    </Modal>
  );
}
