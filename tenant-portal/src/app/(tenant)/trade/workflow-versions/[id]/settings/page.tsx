"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function WorkflowVersionSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات مهلة التجاوز التلقائي (Escalation Timeout)</h2>
      <Input label="مهلة تصعيد المراجعة في حال عدم الرد (بالساعات)" defaultValue="24 Hours" />
      <Button variant="secondary">حفظ سياسة التصعيد</Button>
    </div>
  );
}
