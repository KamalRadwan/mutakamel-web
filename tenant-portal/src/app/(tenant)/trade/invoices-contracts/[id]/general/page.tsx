"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2, Download } from "lucide-react";

export default function InvoiceGeneralPage() {
  const [documentNumber, setDocumentNumber] = useState("INV-2026-9011");
  const [customerName, setCustomerName] = useState("مستشفى السلام الدولي");
  const [totalAmount, setTotalAmount] = useState("138,000.00 SAR");
  const [taxAmount, setTaxAmount] = useState("18,000.00 SAR");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر للمستند التجاري</h2>
          <p className="text-xs text-slate-500">قم بتحديث المبالغ واسم العميل والتحميل المباشر</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="رقم المستند" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} required />
        <Input label="اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label="المبلغ الإجمالي" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
          <Input label="مبلغ الضريبة" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} required />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>حفظ التعديلات المباشرة</span>
          </Button>
          <Button type="button" variant="secondary">
            <Download className="w-4 h-4" />
            <span>تحميل الفاتورة (ZATCA PDF/A-3)</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
