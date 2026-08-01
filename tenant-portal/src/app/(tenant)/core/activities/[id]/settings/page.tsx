"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function ActivitySettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات التنبيه وتغيير الحالة القسرية</h2>
      <Select
        label="حالة التذكير"
        options={[
          { label: "تذكير قبل 15 دقيقة", value: "15m" },
          { label: "تذكير قبل ساعة", value: "1h" },
          { label: "بدون تذكير", value: "none" },
        ]}
      />
      <Button variant="secondary">تحديث التنبيهات</Button>
    </div>
  );
}
