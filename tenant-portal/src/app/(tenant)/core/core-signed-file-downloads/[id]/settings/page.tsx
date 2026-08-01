"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export default function CoreSignedFileSettingsPage() {
  const [expiryHours, setExpiryHours] = useState("24");
  const [maxDownloads, setMaxDownloads] = useState("5");

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">إعدادات الأمان والصلاحيات الزمانية</h2>

      <div className="space-y-4 max-w-xl">
        <Input label="مدة صلاحية الرابط (بالساعات)" type="number" value={expiryHours} onChange={(e) => setExpiryHours(e.target.value)} />
        <Input label="الحد الأقصى لعدد مرات التنزيل" type="number" value={maxDownloads} onChange={(e) => setMaxDownloads(e.target.value)} />

        <div className="pt-2">
          <Button variant="secondary">تحديث إعدادات الأمان</Button>
        </div>
      </div>
    </div>
  );
}
