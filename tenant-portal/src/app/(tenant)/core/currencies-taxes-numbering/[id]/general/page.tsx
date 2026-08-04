"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function CurrencyGeneralPage() {
  const toast = useToast();
  const [code, setCode] = useState("SAR");
  const [name, setName] = useState("ريال سعودي");
  const [symbol, setSymbol] = useState("ر.س");
  const [exchangeRate, setExchangeRate] = useState("1.0");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لأسعار الصرف والرموز</h2>
          <p className="text-xs text-slate-500">قم بتحديث سعر الصرف والاسم فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <div className="grid grid-cols-2 gap-4">
          <Input label="رمز ISO" value={code} onChange={(e) => setCode(e.target.value)} required />
          <Input label="الاسم العربي" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="الرمز المختصر" value={symbol} onChange={(e) => setSymbol(e.target.value)} required />
          <Input label="سعر الصرف" value={exchangeRate} onChange={(e) => setExchangeRate(e.target.value)} required />
        </div>

        <div className="pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ العملة المباشر</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
