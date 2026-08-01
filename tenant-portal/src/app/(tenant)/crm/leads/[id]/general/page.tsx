"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";

export default function LeadGeneralPage() {
  const [leadName, setLeadName] = useState("د. عبد الله المالكي");
  const [company, setCompany] = useState("مستشفى الحياة التخصصي");
  const [email, setEmail] = useState("dr.maliki@alhayat.sa");
  const [phone, setPhone] = useState("+966 50 888 9999");
  const [stage, setStage] = useState("تقديم العرض الفني");
  const [assignedTo, setAssignedTo] = useState("أحمد محمود");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للعميل المحتمل</h2>
          <p className="text-xs text-slate-500">قم بتحديث الاسم والشركة والمرحلة مباشرة</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم العميل المحتمل" value={leadName} onChange={(e) => setLeadName(e.target.value)} required />
        <Input label="الشركة" value={company} onChange={(e) => setCompany(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="البريد الإلكتروني" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="رقم الجوال" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="المرحلة الحالية"
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            options={[
              { label: "تقديم العرض الفني", value: "تقديم العرض الفني" },
              { label: "تم التواصل والتأهيل", value: "تم التواصل والتأهيل" },
            ]}
          />
          <Input label="مسؤول المبيعات" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required />
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
