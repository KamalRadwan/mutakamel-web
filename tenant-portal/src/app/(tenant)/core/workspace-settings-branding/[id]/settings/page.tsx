"use client";

import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function WorkspaceSettingsPage() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6 max-w-xl">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات النطاق المخصص والـ Favicon</h2>
      <Input label="رابط أيقونة المتصفح Favicon URL" defaultValue="/favicon-tenant.ico" />
      <Input label="اسم التذييل الرسمي (Footer Note)" defaultValue="© 2026 جميع الحقوق محفوظة لـ شركة متكامل كراود كابيتال" />
      <Button variant="secondary">حفظ التذييل</Button>
    </div>
  );
}
