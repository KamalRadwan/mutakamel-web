"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { metricName: string; category: "supply_chain" | "sales_velocity" | "inventory_health" | "credit_risk"; currentValue: string; targetThreshold: string }) => void;
}

export function CreateTradeControlTowerModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [metricName, setMetricName] = useState("");
  const [category, setCategory] = useState<"supply_chain" | "sales_velocity" | "inventory_health" | "credit_risk">("supply_chain");
  const [currentValue, setCurrentValue] = useState("");
  const [targetThreshold, setTargetThreshold] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!metricName) return;
    onSubmit({ metricName, category, currentValue, targetThreshold });
    setMetricName("");
    setCurrentValue("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة مؤشر قيادي لبرج المراقبة (Control Tower Metric)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم المؤشر القيادي" placeholder="مثال: نسبة الإرجاع التجاري" value={metricName} onChange={(e) => setMetricName(e.target.value)} required />
        <Select
          label="فئة المؤشر Category"
          value={category}
          onChange={(e) => setCategory(e.target.value as typeof category)}
          options={[
            { label: "سلسلة الإمداد (Supply Chain)", value: "supply_chain" },
            { label: "سرعة مبيعات القنوات (Sales Velocity)", value: "sales_velocity" },
            { label: "سلامة المخزون (Inventory Health)", value: "inventory_health" },
            { label: "مخاطر الائتمان (Credit Risk)", value: "credit_risk" },
          ]}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input label="القيمة الحالية" placeholder="3.5%" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} required />
          <Input label="الحد المستهدف (Threshold)" placeholder="< 1.0%" value={targetThreshold} onChange={(e) => setTargetThreshold(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ المؤشر</Button>
        </div>
      </form>
    </Modal>
  );
}
