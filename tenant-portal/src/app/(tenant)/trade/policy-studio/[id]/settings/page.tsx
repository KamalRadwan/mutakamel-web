"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function PolicySettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات وضع الاختبار والتنفيذ الحثيث (Dry Run Mode)</h2>
      <Input label="تفعيل وضع التخيل دون تطبيق الحفظ" defaultValue="Disabled (Direct Enforcement)" />
      <Button variant="secondary">تحديث نمط التشغيل</Button>
    </div>
  );
}
