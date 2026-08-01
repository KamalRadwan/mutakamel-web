"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function BrowserExampleSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات توثيق الترويسات (Headers Configuration)</h2>
      <Select
        label="ترويسة التوثيق (Auth Header)"
        options={[
          { label: "Bearer JWT Token", value: "bearer" },
          { label: "API Key Header", value: "apikey" },
        ]}
      />
      <Button variant="secondary">حفظ الترويسات</Button>
    </div>
  );
}
