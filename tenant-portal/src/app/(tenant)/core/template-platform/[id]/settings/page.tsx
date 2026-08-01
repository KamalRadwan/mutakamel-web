"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function TemplateSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات ربط بيانات القالب (Data Source Mapping)</h2>
      <Select
        label="مصدر البيانات الافتراضي"
        options={[
          { label: "محرك الفواتير والاشتراكات Core Billing", value: "billing" },
          { label: "محرك المعاملات التجارية Trade Engine", value: "trade" },
          { label: "محرك العملاء والفرص CRM Engine", value: "crm" },
        ]}
      />
      <Button variant="secondary">حفظ التعيين</Button>
    </div>
  );
}
