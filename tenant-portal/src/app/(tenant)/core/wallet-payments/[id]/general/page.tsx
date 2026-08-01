"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";

export default function WalletGeneralPage() {
  const [txNumber, setTxNumber] = useState("TX-2026-901");
  const [amount, setAmount] = useState("5,000.00");
  const [currency, setCurrency] = useState("USD");
  const [paymentGateway, setPaymentGateway] = useState("Stripe Credit Card");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لحركة المحفظة</h2>
          <p className="text-xs text-slate-500">تحديث المبالغ المنسوبة وتأكيد البيانات فورياً</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم التحديث
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="رقم المعاملة" value={txNumber} onChange={(e) => setTxNumber(e.target.value)} required />
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
        <Input label="بوابة الدفع" value={paymentGateway} onChange={(e) => setPaymentGateway(e.target.value)} required />

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
