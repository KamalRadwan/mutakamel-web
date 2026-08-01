"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save, CheckCircle2 } from "lucide-react";

export default function InventoryGeneralPage() {
  const [sku, setSku] = useState("MED-EQ-0091");
  const [productName, setProductName] = useState("جهاز مراقبة العلامات الحيوية (Patient Monitor)");
  const [quantityOnHand, setQuantityOnHand] = useState(450);
  const [reorderPoint, setReorderPoint] = useState(50);
  const [unitPrice, setUnitPrice] = useState("3,200.00 SAR");
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
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">التعديل المباشر لصنف المخزون</h2>
          <p className="text-xs text-slate-500">قم بتعديل الكمية الفطرية والسعر ونقطة إعادة الطلب مباشرة</p>
        </div>
        {isSaved && (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
            <CheckCircle2 className="w-4 h-4" />
            تم الحفظ
          </span>
        )}
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label="رمز SKU" value={sku} onChange={(e) => setSku(e.target.value)} required />
        <Input label="اسم المنتج" value={productName} onChange={(e) => setProductName(e.target.value)} required />
        <div className="grid grid-cols-3 gap-4">
          <Input label="الكمية المتاحة (OnHand)" type="number" value={quantityOnHand} onChange={(e) => setQuantityOnHand(Number(e.target.value))} required />
          <Input label="نقطة إعادة الطلب" type="number" value={reorderPoint} onChange={(e) => setReorderPoint(Number(e.target.value))} required />
          <Input label="سعر الوحدة" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
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
