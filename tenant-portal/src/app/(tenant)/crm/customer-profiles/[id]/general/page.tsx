"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";

export default function CustomerGeneralPage() {
  const [name, setName] = useState("شركة الأمل للتوريدات الطبية");
  const [category, setCategory] = useState("Enterprise");
  const [contactPerson, setContactPerson] = useState("د. فهد بن عبد العزيز");
  const [phone, setPhone] = useState("+966 50 123 4567");
  const [email, setEmail] = useState("info@alamal-med.com");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لبطاقة العميل</h2>
          <p className="text-xs text-slate-500">قم بتحديث بيانات التواصل والمسؤول فورياً</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم الشركة / العميل" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="التصنيف"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[
              { label: "كبار العملاء (VIP)", value: "VIP" },
              { label: "شركات كبرى (Enterprise)", value: "Enterprise" },
              { label: "شركات متوسطة (SME)", value: "SME" },
            ]}
          />
          <Input label="المسؤول المباشر" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="رقم الجوال" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Input label="البريد الإلكتروني" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
