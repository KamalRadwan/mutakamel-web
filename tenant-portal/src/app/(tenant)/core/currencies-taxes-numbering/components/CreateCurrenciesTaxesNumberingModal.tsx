"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { code: string; name: string; symbol: string; exchangeRate: number }) => void;
}

export function CreateCurrenciesTaxesNumberingModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [code, setCode] = useState("EUR");
  const [name, setName] = useState("يورو");
  const [symbol, setSymbol] = useState("€");
  const [exchangeRate, setExchangeRate] = useState(4.1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code || !name) return;
    onSubmit({ code, name, symbol, exchangeRate: Number(exchangeRate) });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة عملة جديدة للمستأجر" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="رمز العملة (ISO Code)" value={code} onChange={(e) => setCode(e.target.value)} required />
          <Input label="اسم العملة" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="الرمز المختصر" value={symbol} onChange={(e) => setSymbol(e.target.value)} required />
          <Input label="سعر الصرف مقابل الريال" type="number" step="0.01" value={exchangeRate} onChange={(e) => setExchangeRate(Number(e.target.value))} required />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ العملة</Button>
        </div>
      </form>
    </Modal>
  );
}
