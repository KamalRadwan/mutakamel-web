"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function BillingInvoiceGeneralPage() {
  const toast = useToast();
  const [invoiceNumber, setInvoiceNumber] = useState("INV-2026-7001");
  const [planName, setPlanName] = useState("الخطة الاحترافية (Enterprise Plan)");
  const [amount, setAmount] = useState("1,200.00");
  const [currency, setCurrency] = useState("USD");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لبنود الفاتورة</h2>
          <p className="text-xs text-slate-500">قم بتحديث قيم ومبالغ الاشتراك مباشرة</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="رقم الفاتورة" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
        <Input label="باقة الاشتراك" value={planName} onChange={(e) => setPlanName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="المبلغ" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <Select
            label="العملة"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { label: "USD ($)", value: "USD" },
              { label: "SAR (ر.س)", value: "SAR" },
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
