"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { invoiceNumber: string; planName: string; amount: string; currency: string; issueDate: string; dueDate: string }) => void;
}

export function CreateBillingInvoicesSubscriptionModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [planName, setPlanName] = useState("الخطة الاحترافية (Enterprise Plan)");
  const [amount, setAmount] = useState("1200.00");
  const [currency, setCurrency] = useState("USD");
  const [issueDate, setIssueDate] = useState("2026-07-25");
  const [dueDate, setDueDate] = useState("2026-08-10");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ invoiceNumber, planName, amount, currency, issueDate, dueDate });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إصدار فاتورة / اشتراك جديد" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="رقم الفاتورة" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} required />
        <Input label="اسم الباقة / الاشتراك" value={planName} onChange={(e) => setPlanName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="المبلغ" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <Select
            label="العملة"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { label: "USD ($)", value: "USD" },
              { label: "SAR (ر.س)", value: "SAR" },
              { label: "AED (د.إ)", value: "AED" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="تاريخ الإصدار" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
          <Input label="تاريخ الاستحقاق" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">إصدار الفاتورة</Button>
        </div>
      </form>
    </Modal>
  );
}
