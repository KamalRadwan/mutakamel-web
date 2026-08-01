"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { txNumber: string; type: "deposit" | "withdrawal" | "charge"; amount: string; currency: string; paymentGateway: string }) => void;
}

export function CreateWalletPaymentsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [txNumber, setTxNumber] = useState(`TX-2026-${Math.floor(100 + Math.random() * 900)}`);
  const [type, setType] = useState<"deposit" | "withdrawal" | "charge">("deposit");
  const [amount, setAmount] = useState("1000.00");
  const [currency, setCurrency] = useState("USD");
  const [paymentGateway, setPaymentGateway] = useState("Stripe Credit Card");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    onSubmit({ txNumber, type, amount, currency, paymentGateway });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إجراء حركة شحن / دفع محفظة جديدة" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="رقم المعاملة (TX Number)" value={txNumber} onChange={(e) => setTxNumber(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="نوع الحركة"
            value={type}
            onChange={(e) => setType(e.target.value as any)}
            options={[
              { label: "شحن رصيد (Deposit)", value: "deposit" },
              { label: "خصم / استقطاع (Charge)", value: "charge" },
              { label: "سحب (Withdrawal)", value: "withdrawal" },
            ]}
          />
          <Input label="المبلغ" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="العملة"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { label: "USD ($)", value: "USD" },
              { label: "SAR (ر.س)", value: "SAR" },
            ]}
          />
          <Select
            label="بوابة الدفع"
            value={paymentGateway}
            onChange={(e) => setPaymentGateway(e.target.value)}
            options={[
              { label: "Stripe Credit Card", value: "Stripe Credit Card" },
              { label: "Bank Wire Transfer", value: "Bank Wire Transfer" },
              { label: "Internal Wallet", value: "Internal Wallet" },
            ]}
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">تأكيد الحركة</Button>
        </div>
      </form>
    </Modal>
  );
}
