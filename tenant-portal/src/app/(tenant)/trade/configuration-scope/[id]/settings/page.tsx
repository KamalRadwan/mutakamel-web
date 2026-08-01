"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function ScopeSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات تفعيل التوريث التلقائي للمستودعات الفرعية</h2>
      <Select
        label="تفعيل التوريث التلقائي (Inherit Default Global Config)"
        options={[
          { label: "مفعل (تلقائي)", value: "enabled" },
          { label: "مستقل (عزل كامل)", value: "isolated" },
        ]}
      />
      <Button variant="secondary">حفظ التوريث</Button>
    </div>
  );
}
