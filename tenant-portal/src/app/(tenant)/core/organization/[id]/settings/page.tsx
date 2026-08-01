"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function OrgSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات عنوان الفرع والمركز المالي</h2>
      <Input label="العنوان الفعلي للفرع" defaultValue="طريق الملك فهد، الرياض، المملكة العربية السعودية" />
      <Input label="رقم السجل التجاري الفرعي" defaultValue="1010998877" />
      <Button variant="secondary">حفظ بيانات الفرع</Button>
    </div>
  );
}
