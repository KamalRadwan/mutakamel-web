"use client";

import { Button } from "@/components/ui/Button";

export default function UserSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">أمان الحساب وإعادة تعيين كلمة المرور</h2>
      <p className="text-xs text-slate-500">إرسال رابط إعادة تعيين كلمة المرور أو تفعيل التوثيق الثنائي (2FA)</p>

      <div className="flex gap-3">
        <Button variant="secondary">إعادة تعيين كلمة المرور</Button>
        <Button variant="danger">تعليق الحساب مؤقتاً</Button>
      </div>
    </div>
  );
}
