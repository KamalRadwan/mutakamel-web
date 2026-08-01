"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";

export default function ActivityGeneralPage() {
  const [title, setTitle] = useState("متابعة العميل المحتمل شركة الأمل");
  const [activityType, setActivityType] = useState("اتصال هاتفي");
  const [assignee, setAssignee] = useState("منى علي");
  const [dueDate, setDueDate] = useState("2026-07-26");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للنشاط</h2>
          <p className="text-xs text-slate-500">قم بتحديث التفاصيل والنوع ومسؤول المهمة بشكل مباشر</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ بنجاح
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="عنوان النشاط" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="نوع النشاط"
            value={activityType}
            onChange={(e) => setActivityType(e.target.value)}
            options={[
              { label: "اتصال هاتفي", value: "اتصال هاتفي" },
              { label: "بريد إلكتروني", value: "بريد إلكتروني" },
              { label: "اجتماع حضوري", value: "اجتماع حضوري" },
            ]}
          />
          <Select
            label="المسؤول"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            options={[
              { label: "منى علي", value: "منى علي" },
              { label: "أحمد محمود", value: "أحمد محمود" },
            ]}
          />
        </div>
        <Input label="تاريخ الاستحقاق" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />

        <div className="pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ التعديلات الحالية</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
