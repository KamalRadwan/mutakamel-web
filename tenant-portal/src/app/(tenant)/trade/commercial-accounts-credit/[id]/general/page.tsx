"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";

export default function AccountGeneralPage() {
  const toast = useToast();
  const [accountName, setAccountName] = useState("مستشفى السلام الدولي");
  const [accountNumber, setAccountNumber] = useState("ACT-88201");
  const [creditLimit, setCreditLimit] = useState("500,000.00 SAR");
  const [paymentTerms, setPaymentTerms] = useState("Net 60 Days");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للحساب التجاري</h2>
          <p className="text-xs text-slate-500">قم بتحديث الحد الائتماني وشروط الدفع مباشرة</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="اسم الحساب التجاري" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
        <Input label="رقم الحساب" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="الحد الائتماني" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} required />
          <Select
            label="شروط الدفع"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            options={[
              { label: "Net 60 Days", value: "Net 60 Days" },
              { label: "Net 30 Days", value: "Net 30 Days" },
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
