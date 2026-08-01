"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function WalletSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات حد الشحن السريع والتنبيهات المباشرة</h2>
      <Input label="الحد الأدنى للرخص قبل التنبيه" type="number" defaultValue="200" />
      <Button variant="secondary">حفظ حد التنبيهات</Button>
    </div>
  );
}
