"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function SourceSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات تتبع UTM والرابط التلقائي</h2>
      <Input label="معرف التتبع UTM Campaign ID" defaultValue="google_ads_search_2026" />
      <Button variant="secondary">تحديث التتبع</Button>
    </div>
  );
}
