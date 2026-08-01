"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; customerName: string; amount: string; currency: string; currentStage: string; assignedOwner: string; expectedCloseDate: string }) => void;
}

export function CreateOpportunitiesStageHistoryModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("شركة الأمل للتوريدات الطبية");
  const [amount, setAmount] = useState("250000.00");
  const [currency, setCurrency] = useState("SAR");
  const [currentStage, setCurrentStage] = useState("تقديم العرض الفني");
  const [assignedOwner, setAssignedOwner] = useState("أحمد محمود");
  const [expectedCloseDate, setExpectedCloseDate] = useState("2026-08-30");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    onSubmit({ title, customerName, amount, currency, currentStage, assignedOwner, expectedCloseDate });
    setTitle("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة فرصة تجارية جديدة (Opportunity)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="عنوان الفرصة / الصفقة" placeholder="مثال: توريد وتخصيص النظام" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Input label="اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="قيمة الفرصة" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <Select
            label="العملة"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { label: "SAR (ر.س)", value: "SAR" },
              { label: "USD ($)", value: "USD" },
            ]}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select
            label="المرحلة الأولى"
            value={currentStage}
            onChange={(e) => setCurrentStage(e.target.value)}
            options={[
              { label: "تقديم العرض الفني", value: "تقديم العرض الفني" },
              { label: "المفاوضات النهائية", value: "المفاوضات النهائية" },
            ]}
          />
          <Input label="مسؤول الصفقة" value={assignedOwner} onChange={(e) => setAssignedOwner(e.target.value)} required />
          <Input label="تاريخ الإغلاق المتوقع" value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الفرصة</Button>
        </div>
      </form>
    </Modal>
  );
}
