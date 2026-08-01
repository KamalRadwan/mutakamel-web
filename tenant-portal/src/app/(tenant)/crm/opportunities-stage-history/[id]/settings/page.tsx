"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function OpportunitySettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات ونطاق الخصم المسموح للفرصة</h2>
      <Input label="حد الخصم الأقصى المسموح" defaultValue="10%" />
      <Button variant="secondary">حفظ التسهيلات</Button>
    </div>
  );
}
