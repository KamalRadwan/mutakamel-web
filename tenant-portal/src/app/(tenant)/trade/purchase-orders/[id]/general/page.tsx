"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";

export default function PurchaseOrderGeneralPage() {
  const [poNumber, setPoNumber] = useState("PO-2026-7701");
  const [supplierName, setSupplierName] = useState("شركة فيليبس للأجهزة الطبية العالمية");
  const [warehouseName, setWarehouseName] = useState("المستودع الرئيسي - الرياض");
  const [totalCost, setTotalCost] = useState("850,000.00 SAR");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لأمر الشراء</h2>
          <p className="text-xs text-slate-500">قم بتحديث التكلفة والمورد والمستودع المستلم مباشرة</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="رقم أمر الشراء PO Number" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required />
        <Input label="اسم المورد" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="المستودع المستلم"
            value={warehouseName}
            onChange={(e) => setWarehouseName(e.target.value)}
            options={[
              { label: "المستودع الرئيسي - الرياض", value: "المستودع الرئيسي - الرياض" },
              { label: "مستودع التوزيع - جدة", value: "مستودع التوزيع - جدة" },
            ]}
          />
          <Input label="التكلفة الإجمالية" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} required />
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
