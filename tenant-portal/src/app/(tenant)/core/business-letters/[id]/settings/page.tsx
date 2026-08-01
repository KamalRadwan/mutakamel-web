"use client";

import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

export default function BusinessLetterSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات الهيدر والختم الرسمي للخطاب</h2>
      <Select
        label="الشعار والختم الافتراضي"
        options={[
          { label: "شعار المستأجر الرئيسي + الختم الرقمي", value: "logo_stamp" },
          { label: "بدون ختم رسمي", value: "logo_only" },
        ]}
      />
      <Button variant="secondary">حفظ التفضيلات</Button>
    </div>
  );
}
