"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function ProvisioningUpdateSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سياسة التحديث الصيانة والتراجع (Rollback Policy)</h2>
      <Select
        label="خيار التراجع عند الفشل"
        options={[
          { label: "تراجع تلقائي (Auto Rollback)", value: "auto" },
          { label: "إيقاف السيرفر ومراجعة الأدمن", value: "manual" },
        ]}
      />
      <Button variant="secondary">حفظ التفضيلات</Button>
    </div>
  );
}
