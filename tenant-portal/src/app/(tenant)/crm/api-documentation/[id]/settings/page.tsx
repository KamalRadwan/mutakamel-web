"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function ApiDocSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات توثيق Swagger وشكل الاستجابة MOCK</h2>
      <Input label="شكل الاستجابة القياسي Envelope" defaultValue="Canonical Response Envelope (success, data, meta)" />
      <Button variant="secondary">توليد Mock Data</Button>
    </div>
  );
}
