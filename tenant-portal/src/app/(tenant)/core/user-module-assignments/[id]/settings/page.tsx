"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function UserModuleSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات سعة ونطاق الموديول</h2>
      <Select
        label="مستوى الوصول للموديول"
        options={[
          { label: "وصول كامل (Full Access)", value: "full" },
          { label: "قراءة فقط (Read Only)", value: "readonly" },
        ]}
      />
      <Button variant="secondary">حفظ التفضيلات</Button>
    </div>
  );
}
