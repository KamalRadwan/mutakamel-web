"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function CrmTaskSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات التذكير والتكامل مع Google Calendar</h2>
      <Select
        label="قناة التذكير الفوري"
        options={[
          { label: "إشعار النظام + بريد إلكتروني", value: "all" },
          { label: "إشعار النظام فقط", value: "system" },
        ]}
      />
      <Button variant="secondary">مزامنة التذكيرات</Button>
    </div>
  );
}
