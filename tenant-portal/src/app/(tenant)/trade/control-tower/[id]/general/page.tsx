"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function ControlTowerGeneralPage() {
  const toast = useToast();
  const [metricName, setMetricName] = useState("معدل سرعة تدوير المخزون (Stock Turnover Rate)");
  const [category, setCategory] = useState("inventory_health");
  const [currentValue, setCurrentValue] = useState("4.8x");
  const [targetThreshold, setTargetThreshold] = useState("5.0x");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لمؤشر برج المراقبة</h2>
          <p className="text-xs text-slate-500">قم بتحديث القيمة والحد المستهدف فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم المؤشر القيادي" value={metricName} onChange={(e) => setMetricName(e.target.value)} required />
        <Select
          label="فئة المؤشر"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={[
            { label: "سلامة المخزون (Inventory Health)", value: "inventory_health" },
            { label: "سلسلة الإمداد (Supply Chain)", value: "supply_chain" },
          ]}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="القيمة الحالية" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} required />
          <Input label="الحد المستهدف" value={targetThreshold} onChange={(e) => setTargetThreshold(e.target.value)} required />
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
