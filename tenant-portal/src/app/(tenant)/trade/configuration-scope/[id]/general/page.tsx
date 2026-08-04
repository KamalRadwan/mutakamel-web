"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function ScopeGeneralPage() {
  const toast = useToast();
  const [scopeName, setScopeName] = useState("نطاق التهيئة للمركز الرئيسي - الرياض");
  const [targetCode, setTargetCode] = useState("HQ-RUH");
  const [scopeLevel, setScopeLevel] = useState("global");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لنطاق التهيئة</h2>
          <p className="text-xs text-slate-500">قم بتحديث اسم النطاق وكود الهدف فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم نطاق التهيئة" value={scopeName} onChange={(e) => setScopeName(e.target.value)} required />
        <Input label="كود الهدف Target Code" value={targetCode} onChange={(e) => setTargetCode(e.target.value)} required />
        <Select
          label="مستوى النطاق"
          value={scopeLevel}
          onChange={(e) => setScopeLevel(e.target.value)}
          options={[
            { label: "عام لجميع الفروع (Global)", value: "global" },
            { label: "فرع محدد (Branch)", value: "branch" },
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
