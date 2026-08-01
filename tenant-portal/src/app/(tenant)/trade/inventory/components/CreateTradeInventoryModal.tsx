"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { sku: string; productName: string; warehouseName: string; quantityOnHand: number; reorderPoint: number; unitPrice: string }) => void;
}

export function CreateTradeInventoryModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [sku, setSku] = useState("");
  const [productName, setProductName] = useState("");
  const [warehouseName, setWarehouseName] = useState("المستودع الرئيسي - الرياض");
  const [quantityOnHand, setQuantityOnHand] = useState(100);
  const [reorderPoint, setReorderPoint] = useState(20);
  const [unitPrice, setUnitPrice] = useState("250.00 SAR");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sku || !productName) return;
    onSubmit({ sku, productName, warehouseName, quantityOnHand: Number(quantityOnHand), reorderPoint: Number(reorderPoint), unitPrice });
    setSku("");
    setProductName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة صنف وسجل مخزون جديد" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="رمز SKU" placeholder="MED-EQ-9900" value={sku} onChange={(e) => setSku(e.target.value)} required />
        <Input label="اسم المنتج / الصنف" placeholder="جهاز فحص ضغط الدم" value={productName} onChange={(e) => setProductName(e.target.value)} required />
        <Select
          label="المستودع"
          value={warehouseName}
          onChange={(e) => setWarehouseName(e.target.value)}
          options={[
            { label: "المستودع الرئيسي - الرياض", value: "المستودع الرئيسي - الرياض" },
            { label: "مستودع التوزيع - جدة", value: "مستودع التوزيع - جدة" },
          ]}
        />
        <div className="grid grid-cols-3 gap-3">
          <Input label="الكمية الفطرية (OnHand)" type="number" value={quantityOnHand} onChange={(e) => setQuantityOnHand(Number(e.target.value))} required />
          <Input label="نقطة إعادة الطلب" type="number" value={reorderPoint} onChange={(e) => setReorderPoint(Number(e.target.value))} required />
          <Input label="سعر الوحدة" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ المخزون</Button>
        </div>
      </form>
    </Modal>
  );
}
