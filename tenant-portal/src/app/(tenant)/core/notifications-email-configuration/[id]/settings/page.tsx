"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function NotificationConfigSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات الأمان والتشفير (TLS / SSL)</h2>
      <Input label="اسم المستخدم لخادم SMTP Username" defaultValue="mailgun-smtp-user" />
      <Input label="كلمة المرور SMTP Password" type="password" defaultValue="••••••••••••" />
      <Button variant="secondary">حفظ التشفير</Button>
    </div>
  );
}
