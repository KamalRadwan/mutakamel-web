"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function OrderGeneralPage() {
  const toast = useToast();
  const [orderNumber, setOrderNumber] = useState("SO-2026-8801");
  const [customerName, setCustomerName] = useState("مستشفى السلام الدولي");
  const [totalAmount, setTotalAmount] = useState("138,000.00 SAR");
  const [validityOrDeliveryDate, setValidityOrDeliveryDate] = useState("2026-08-01");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لأمر / عرض المبيعات</h2>
          <p className="text-xs text-slate-500">قم بتحديث المبلغ الإجمالي واسم العميل وتاريخ التسليم فورياً</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="رقم المستند" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
        <Input label="اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="المبلغ الإجمالي" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
          <Input label="تاريخ التسليم المتوقع" value={validityOrDeliveryDate} onChange={(e) => setValidityOrDeliveryDate(e.target.value)} required />
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
