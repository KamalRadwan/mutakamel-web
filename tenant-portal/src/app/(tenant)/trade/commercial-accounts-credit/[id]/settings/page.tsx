"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function AccountSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات الإيقاف الحظر الائتماني التلقائي</h2>
      <Select
        label="حظر إصدار فواتير جديدة عند تجاوز السقف"
        options={[
          { label: "نعم (حظر تلقائي)", value: "yes" },
          { label: "لا (إرسال تنبيه فقط)", value: "no" },
        ]}
      />
      <Button variant="secondary">حفظ التنبيهات</Button>
    </div>
  );
}
