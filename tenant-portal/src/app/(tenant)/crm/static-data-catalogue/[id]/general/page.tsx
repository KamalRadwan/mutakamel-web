"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";

export default function CatalogueGeneralPage() {
  const [catalogName, setCatalogName] = useState("دليل القطاعات والأنشطة الاقتصادية (Industry Types)");
  const [category, setCategory] = useState("industry_types");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للكتالوج المرجعي</h2>
          <p className="text-xs text-slate-500">قم بتحديث الاسم والتصنيف مباشرة</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم الكتالوج المرجعي" value={catalogName} onChange={(e) => setCatalogName(e.target.value)} required />
        <Select
          label="التصنيف المرجعي"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          options={[
            { label: "أنواع القطاعات (Industry Types)", value: "industry_types" },
            { label: "أسباب الخسارة (Deal Lost Reasons)", value: "deal_reasons" },
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
