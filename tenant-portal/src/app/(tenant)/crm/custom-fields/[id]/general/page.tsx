"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";

export default function CustomFieldGeneralPage() {
  const [label, setLabel] = useState("ميزانية العميل المتوقعة");
  const [key, setKey] = useState("expected_budget");
  const [targetEntity, setTargetEntity] = useState("lead");
  const [fieldType, setFieldType] = useState("number");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للحقل المخصص</h2>
          <p className="text-xs text-slate-500">تحديث عنوان الحقل والنوع فورياً</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="عنوان الحقل" value={label} onChange={(e) => setLabel(e.target.value)} required />
        <Input label="المفتاح البرمجي Key" value={key} onChange={(e) => setKey(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="الكيان المستهدف"
            value={targetEntity}
            onChange={(e) => setTargetEntity(e.target.value)}
            options={[
              { label: "عميل محتمل (Lead)", value: "lead" },
              { label: "صفقة تجارية (Deal)", value: "deal" },
            ]}
          />
          <Select
            label="نوع الحقل"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value)}
            options={[
              { label: "رقم (Number)", value: "number" },
              { label: "نص (Text)", value: "text" },
            ]}
          />
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
