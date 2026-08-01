"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function NoteSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سياسة صلاحيات الوصول للملاحظة</h2>
      <Select
        label="مستوى الخصوصية"
        options={[
          { label: "عامة لفريق المبيعات (Public)", value: "public" },
          { label: "خاصة بالمُنشئ فقط (Private)", value: "private" },
        ]}
      />
      <Button variant="secondary">حفظ الخصوصية</Button>
    </div>
  );
}
