"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function TradeAiSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات درجات الـ Temperature وحدود الـ Tokens</h2>
      <Input label="Temperature Scale (0.0 - 1.0)" defaultValue="0.2" />
      <Button variant="secondary">تعديل المعلمات</Button>
    </div>
  );
}
