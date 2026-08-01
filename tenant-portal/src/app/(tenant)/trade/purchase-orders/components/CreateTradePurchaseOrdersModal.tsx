"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { poNumber: string; supplierName: string; warehouseName: string; totalCost: string; expectedDeliveryDate: string; paymentTerms: string }) => void;
}

export function CreateTradePurchaseOrdersModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [poNumber, setPoNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [warehouseName, setWarehouseName] = useState("المستودع الرئيسي - الرياض");
  const [totalCost, setTotalCost] = useState("250,000.00 SAR");
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("2026-08-15");
  const [paymentTerms, setPaymentTerms] = useState("Net 60 Days");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!poNumber || !supplierName) return;
    onSubmit({ poNumber, supplierName, warehouseName, totalCost, expectedDeliveryDate, paymentTerms });
    setPoNumber("");
    setSupplierName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إصدار أمر شراء مجمّع (Purchase Order)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="رقم أمر الشراء PO Number" placeholder="PO-2026-9900" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required />
        <Input label="اسم المورد" placeholder="شركة فيليبس العالمية" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
        <Select
          label="المستودع المستلم"
          value={warehouseName}
          onChange={(e) => setWarehouseName(e.target.value)}
          options={[
            { label: "المستودع الرئيسي - الرياض", value: "المستودع الرئيسي - الرياض" },
            { label: "مستودع التوزيع - جدة", value: "مستودع التوزيع - جدة" },
          ]}
        />
        <div className="grid grid-cols-3 gap-3">
          <Input label="التكلفة الإجمالية" value={totalCost} onChange={(e) => setTotalCost(e.target.value)} required />
          <Input label="تاريخ التسليم المتوقع" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} required />
          <Input label="شروط الدفع" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">إصدار أمر الشراء</Button>
        </div>
      </form>
    </Modal>
  );
}
