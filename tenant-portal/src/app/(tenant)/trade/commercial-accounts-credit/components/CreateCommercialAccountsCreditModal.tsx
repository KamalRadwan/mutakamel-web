"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { accountName: string; accountNumber: string; creditLimit: string; paymentTerms: string }) => void;
}

export function CreateCommercialAccountsCreditModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [creditLimit, setCreditLimit] = useState("200000.00 SAR");
  const [paymentTerms, setPaymentTerms] = useState("Net 30 Days");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountName || !accountNumber) return;
    onSubmit({ accountName, accountNumber, creditLimit, paymentTerms });
    setAccountName("");
    setAccountNumber("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة حساب تجاري والحد الائتماني" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم الحساب التجاري" placeholder="مستشفى السلام الدولي" value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
        <Input label="رقم الحساب التجاري Code" placeholder="ACT-9901" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="السقف الائتماني (Credit Limit)" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} required />
          <Select
            label="شروط الدفع (Payment Terms)"
            value={paymentTerms}
            onChange={(e) => setPaymentTerms(e.target.value)}
            options={[
              { label: "Net 30 Days (آجل 30 يوم)", value: "Net 30 Days" },
              { label: "Net 60 Days (آجل 60 يوم)", value: "Net 60 Days" },
              { label: "Immediate Cash (نقدي مباشر)", value: "Immediate Cash" },
            ]}
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الحساب</Button>
        </div>
      </form>
    </Modal>
  );
}
