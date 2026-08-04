"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function PolicyGeneralPage() {
  const toast = useToast();
  const [policyName, setPolicyName] = useState("سياسة الخصم التلقائي لطلبات الجملة (> 100,000 SAR)");
  const [policyType, setPolicyType] = useState("pricing_rule");
  const [priorityOrder, setPriorityOrder] = useState(1);
  const [conditionExpression, setConditionExpression] = useState("order.total_amount >= 100000");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لسياسة الأعمال</h2>
          <p className="text-xs text-slate-500">قم بتحديث اسم السياسة والشروط والأولوية فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم السياسة والقاعدة" value={policyName} onChange={(e) => setPolicyName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="نوع السياسة"
            value={policyType}
            onChange={(e) => setPolicyType(e.target.value)}
            options={[
              { label: "قواعد التسعير (Pricing Rule)", value: "pricing_rule" },
              { label: "حماية الائتمان (Credit Guard)", value: "credit_guard" },
            ]}
          />
          <Input label="الأولوية Order" type="number" value={priorityOrder} onChange={(e) => setPriorityOrder(Number(e.target.value))} required />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">تعبير الشرط Condition</label>
          <textarea
            rows={3}
            value={conditionExpression}
            onChange={(e) => setConditionExpression(e.target.value)}
            className="w-full p-3 font-mono text-xs bg-slate-900 text-emerald-400 border border-slate-800 rounded-xl"
          />
        </div>

        <div className="pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ التعديلات المباشرة</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
