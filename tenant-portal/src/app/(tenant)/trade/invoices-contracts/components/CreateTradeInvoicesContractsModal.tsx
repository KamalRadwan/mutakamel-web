"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { documentNumber: string; documentType: "invoice" | "contract" | "credit_note"; customerName: string; totalAmount: string; taxAmount: string; issueDate: string }) => void;
}

export function CreateTradeInvoicesContractsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentType, setDocumentType] = useState<"invoice" | "contract" | "credit_note">("invoice");
  const [customerName, setCustomerName] = useState("");
  const [totalAmount, setTotalAmount] = useState("100000.00 SAR");
  const [taxAmount, setTaxAmount] = useState("13043.48 SAR");
  const [issueDate, setIssueDate] = useState("2026-07-25");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!documentNumber || !customerName) return;
    onSubmit({ documentNumber, documentType, customerName, totalAmount, taxAmount, issueDate });
    setDocumentNumber("");
    setCustomerName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إصدار فاتورة أو عقد تجاري جديد" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="نوع المستند"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as any)}
          options={[
            { label: "فاتورة ضريبية (Invoice)", value: "invoice" },
            { label: "عقد تجاري سنوي (Contract)", value: "contract" },
            { label: "إشعار دائن (Credit Note)", value: "credit_note" },
          ]}
        />
        <Input label="رقم المستند" placeholder="INV-2026-9900" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} required />
        <Input label="اسم العميل التجاري" placeholder="مستشفى السلام" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
        <div className="grid grid-cols-3 gap-3">
          <Input label="المبلغ الإجمالي" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
          <Input label="مبلغ الضريبة" value={taxAmount} onChange={(e) => setTaxAmount(e.target.value)} required />
          <Input label="تاريخ الإصدار" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">إصدار المستند</Button>
        </div>
      </form>
    </Modal>
  );
}
