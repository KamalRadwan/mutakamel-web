"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function OrderSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات تحويل عرض السعر إلى أمر بيع تلقائياً</h2>
      <Select
        label="التسليم الآلي بعد توقيع العميل"
        options={[
          { label: "مفعل (توليد SO فورياً)", value: "auto_so" },
          { label: "مراجعة الائتمان أولاً", value: "credit_review" },
        ]}
      />
      <Button variant="secondary">حفظ نمط التحويل</Button>
    </div>
  );
}
