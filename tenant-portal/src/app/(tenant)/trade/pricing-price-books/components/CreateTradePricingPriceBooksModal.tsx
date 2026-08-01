"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { bookName: string; currency: string; targetCustomerGroup: string; discountPercentage: string }) => void;
}

export function CreateTradePricingPriceBooksModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [bookName, setBookName] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [targetCustomerGroup, setTargetCustomerGroup] = useState("Enterprise Medical");
  const [discountPercentage, setDiscountPercentage] = useState("10.00%");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookName) return;
    onSubmit({ bookName, currency, targetCustomerGroup, discountPercentage });
    setBookName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة كتاب قوائم أسعار جديد (Price Book)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم كتاب الأسعار" placeholder="مثال: قائمة أسعار صيدليات النهدي" value={bookName} onChange={(e) => setBookName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label="العملة"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { label: "SAR (ر.س)", value: "SAR" },
              { label: "USD ($)", value: "USD" },
            ]}
          />
          <Input label="نسبة الخصم المبدئية %" value={discountPercentage} onChange={(e) => setDiscountPercentage(e.target.value)} required />
        </div>
        <Input label="المجموعة المستهدفة Target Group" value={targetCustomerGroup} onChange={(e) => setTargetCustomerGroup(e.target.value)} required />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ قائمة الأسعار</Button>
        </div>
      </form>
    </Modal>
  );
}
