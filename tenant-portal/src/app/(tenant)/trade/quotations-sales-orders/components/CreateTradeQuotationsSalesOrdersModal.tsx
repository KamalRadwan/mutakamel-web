"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { orderNumber: string; type: "sales_quotation" | "sales_order"; customerName: string; totalAmount: string; validityOrDeliveryDate: string }) => void;
}

export function CreateTradeQuotationsSalesOrdersModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [orderNumber, setOrderNumber] = useState("");
  const [type, setType] = useState<"sales_quotation" | "sales_order">("sales_order");
  const [customerName, setCustomerName] = useState("");
  const [totalAmount, setTotalAmount] = useState("120,000.00 SAR");
  const [validityOrDeliveryDate, setValidityOrDeliveryDate] = useState("2026-08-10");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber || !customerName) return;
    onSubmit({ orderNumber, type, customerName, totalAmount, validityOrDeliveryDate });
    setOrderNumber("");
    setCustomerName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إصدار عرض سعر أو أمر بيع مجمّع" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="نوع المستند"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          options={[
            { label: "أمر بيع مؤكد (Sales Order)", value: "sales_order" },
            { label: "عرض سعر مبيعات (Sales Quotation)", value: "sales_quotation" },
          ]}
        />
        <Input label="رقم المستند" placeholder="SO-2026-990" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} required />
        <Input label="اسم العميل" placeholder="مستشفى السلام" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="المبلغ الإجمالي" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
          <Input label="تاريخ التسليم / الصلاحية" value={validityOrDeliveryDate} onChange={(e) => setValidityOrDeliveryDate(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">إصدار المستند</Button>
        </div>
      </form>
    </Modal>
  );
}
