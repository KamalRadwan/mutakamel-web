"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function CatalogUomGeneralPage() {
  const toast = useToast();
  const [name, setName] = useState("كرتونة سعة 24 حبة (Box of 24)");
  const [code, setCode] = useState("BOX24");
  const [conversionFactor, setConversionFactor] = useState("24");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لوحدة القياس / الكتالوج</h2>
          <p className="text-xs text-slate-500">قم بتحديث الاسم ومعامل التحويل فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="الاسم / التعريف" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="الكود البرمجي Code" value={code} onChange={(e) => setCode(e.target.value)} required />
        <Input label="معامل التحويل Conversion Factor" type="number" value={conversionFactor} onChange={(e) => setConversionFactor(e.target.value)} required />

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
