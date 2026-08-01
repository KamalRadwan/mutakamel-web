"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function InventorySettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات الحجز التلقائي وإعادة الطلب (Auto Re-Order)</h2>
      <Select
        label="إرسال أمر شراء تلقائي عند وصول النقطة الحرجة"
        options={[
          { label: "مفعل تلقائياً", value: "enabled" },
          { label: "تنبيه فقط (مسودة أمر شراء)", value: "draft_only" },
        ]}
      />
      <Button variant="secondary">حفظ قواعد الأتمتة</Button>
    </div>
  );
}
