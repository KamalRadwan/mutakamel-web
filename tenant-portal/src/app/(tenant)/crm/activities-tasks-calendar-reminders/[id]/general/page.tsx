"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";

export default function CrmTaskGeneralPage() {
  const [subject, setSubject] = useState("جلسة عرض تقديمي (Demo) لنظام إدارة المخزون");
  const [leadOrCustomer, setLeadOrCustomer] = useState("شركة الأمل للتوريدات الطبية");
  const [taskType, setTaskType] = useState("demo");
  const [dueDate, setDueDate] = useState("2026-07-28 11:00");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للمهمة</h2>
          <p className="text-xs text-slate-500">قم بتحديث الموضوع والتوقاريخ مباشرة</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="موضوع المهمة" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <Input label="العميل المرتبط" value={leadOrCustomer} onChange={(e) => setLeadOrCustomer(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="نوع الفعالية"
            value={taskType}
            onChange={(e) => setTaskType(e.target.value)}
            options={[
              { label: "عرض حيا (Demo)", value: "demo" },
              { label: "اتصال تلفوني (Call)", value: "call" },
              { label: "اجتماع عمل (Meeting)", value: "meeting" },
            ]}
          />
          <Input label="التاريخ والوقت" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>

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
