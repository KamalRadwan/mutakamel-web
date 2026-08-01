"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function InvoiceSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات توقيع ZATCA XML ورمز الاستجابة السريعة (QR)</h2>
      <Input label="ZATCA UUID" defaultValue="c92a-8801-4491-b2c9" />
      <Button variant="secondary">التحقق من صحة الفاتورة</Button>
    </div>
  );
}
