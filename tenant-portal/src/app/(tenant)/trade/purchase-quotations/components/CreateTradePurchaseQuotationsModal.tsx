"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { rfqNumber: string; supplierName: string; quotedCost: string; validUntil: string; deliveryLeadTime: string }) => void;
}

export function CreateTradePurchaseQuotationsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [rfqNumber, setRfqNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [quotedCost, setQuotedCost] = useState("500,000.00 SAR");
  const [validUntil, setValidUntil] = useState("2026-09-01");
  const [deliveryLeadTime, setDeliveryLeadTime] = useState("10 أيام");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rfqNumber || !supplierName) return;
    onSubmit({ rfqNumber, supplierName, quotedCost, validUntil, deliveryLeadTime });
    setRfqNumber("");
    setSupplierName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تسجيل عرض سعر شراء من مورد (Purchase Quotation)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="رقم طلب/عرض السعر RFQ" placeholder="RFQ-2026-990" value={rfqNumber} onChange={(e) => setRfqNumber(e.target.value)} required />
        <Input label="اسم المورد المتقدم" placeholder="شركة الشفاء الطبية" value={supplierName} onChange={(e) => setSupplierName(e.target.value)} required />
        <div className="grid grid-cols-3 gap-3">
          <Input label="التكلفة المعروضة" value={quotedCost} onChange={(e) => setQuotedCost(e.target.value)} required />
          <Input label="صالح حتى" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} required />
          <Input label="مدة التوريد" value={deliveryLeadTime} onChange={(e) => setDeliveryLeadTime(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">تسجيل العرض</Button>
        </div>
      </form>
    </Modal>
  );
}
