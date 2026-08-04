"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function OrgGeneralPage() {
  const toast = useToast();
  const [name, setName] = useState("فرع الرياض الرئيسي");
  const [unitType, setUnitType] = useState("branch");
  const [code, setCode] = useState("BR-RUH");
  const [manager, setManager] = useState("أحمد محمود");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للفرع / القسم</h2>
          <p className="text-xs text-slate-500">قم بتحديث الاسم، الكود والمدير المسؤول فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم الوحدة التنظيمية" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="نوع الوحدة"
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
            options={[
              { label: "شركة (Company)", value: "company" },
              { label: "فرع (Branch)", value: "branch" },
              { label: "قسم (Department)", value: "department" },
            ]}
          />
          <Input label="كود الوحدة" value={code} onChange={(e) => setCode(e.target.value)} required />
        </div>
        <Input label="المدير المسؤول" value={manager} onChange={(e) => setManager(e.target.value)} required />

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
