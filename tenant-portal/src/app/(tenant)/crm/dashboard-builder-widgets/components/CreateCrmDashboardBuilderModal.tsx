"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; type: "chart_bar" | "chart_line" | "stat_card" | "funnel"; metric: string; refreshInterval: string }) => void;
}

export function CreateCrmDashboardBuilderModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"chart_bar" | "chart_line" | "stat_card" | "funnel">("chart_bar");
  const [metric, setMetric] = useState("إجمالي قيمة الصفقات المغلقة");
  const [refreshInterval, setRefreshInterval] = useState("5 mins");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, type, metric, refreshInterval });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة وتصرف الـ Widget في لوحة التحليلات" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم الـ Widget" placeholder="مثال: رسم بياني للصفقات الكبرى" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="نوع الرسم / الودجت"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            options={[
              { label: "مخطط أعمدة (Bar Chart)", value: "chart_bar" },
              { label: "مخطط خطي (Line Chart)", value: "chart_line" },
              { label: "بطاقة رقمية (Stat Card)", value: "stat_card" },
              { label: "قمع تحويل (Funnel)", value: "funnel" },
            ]}
          />
          <Input label="المقياس المستهدف Metric" value={metric} onChange={(e) => setMetric(e.target.value)} required />
        </div>
        <Select
          label="معدل التحديث التلقائي"
          value={refreshInterval}
          onChange={(e) => setRefreshInterval(e.target.value)}
          options={[
            { label: "لحظي Real-time", value: "Real-time" },
            { label: "كل 5 دقائق", value: "5 mins" },
            { label: "كل 15 دقيقة", value: "15 mins" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">إضافة الـ Widget</Button>
        </div>
      </form>
    </Modal>
  );
}
