"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";

export default function UserModuleGeneralPage() {
  const [userName, setUserName] = useState("منى علي");
  const [userEmail, setUserEmail] = useState("mona@tenant.com");
  const [moduleKey, setModuleKey] = useState("crm");
  const [isSaved, setIsSaved] = useState(false);

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لتخصيص الموديول</h2>
          <p className="text-xs text-slate-500">قم بتغيير الموديول المنسوب للمستخدم مباشرة</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم المستخدم" value={userName} onChange={(e) => setUserName(e.target.value)} required />
        <Input label="البريد الإلكتروني" type="email" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} required />
        <Select
          label="الموديول المراد ربطه"
          value={moduleKey}
          onChange={(e) => setModuleKey(e.target.value)}
          options={[
            { label: "إدارة العملاء (CRM Module)", value: "crm" },
            { label: "التجارة والعمليات (Trade Module)", value: "trade" },
            { label: "النظام الأساسي (Core System)", value: "core" },
          ]}
        />

        <div className="pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ التعديلات المباشرة</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
