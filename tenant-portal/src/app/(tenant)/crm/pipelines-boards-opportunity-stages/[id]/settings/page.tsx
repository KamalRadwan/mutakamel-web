"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function PipelineSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات سحب وإسقاط البطاقات (Drag & Drop Rules)</h2>
      <Input label="الموافقة المطلوبة عند تخطي مرحلة" defaultValue="مدير المبيعات" />
      <Button variant="secondary">حفظ التفضيلات</Button>
    </div>
  );
}
