"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";

export default function PriceBookGeneralPage() {
  const [bookName, setBookName] = useState("كتالوج أسعار المستشفيات والقطاع الطبي العام");
  const [currency, setCurrency] = useState("SAR");
  const [targetCustomerGroup, setTargetCustomerGroup] = useState("Enterprise Medical");
  const [discountPercentage, setDiscountPercentage] = useState("15.00%");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لكتاب قوائم الأسعار</h2>
          <p className="text-xs text-slate-500">قم بتحديث اسم القائمة ونسبة الخصم مباشرة</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم كتاب الأسعار" value={bookName} onChange={(e) => setBookName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="العملة"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { label: "SAR (ر.س)", value: "SAR" },
              { label: "USD ($)", value: "USD" },
            ]}
          />
          <Input label="نسبة الخصم %" value={discountPercentage} onChange={(e) => setDiscountPercentage(e.target.value)} required />
        </div>
        <Input label="المجموعة المستهدفة" value={targetCustomerGroup} onChange={(e) => setTargetCustomerGroup(e.target.value)} required />

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
