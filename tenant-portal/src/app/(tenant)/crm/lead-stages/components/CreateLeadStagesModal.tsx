"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; order: number; color: string; winProbability: string }) => void;
}

export function CreateLeadStagesModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [name, setName] = useState("");
  const [order, setOrder] = useState(6);
  const [color, setColor] = useState("#3b82f6");
  const [winProbability, setWinProbability] = useState("50%");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, order: Number(order), color, winProbability });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة مرحلة جديدة لقمع المبيعات" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم المرحلة" placeholder="مثال: مراجعة الدعم الفني" value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-3 gap-3">
          <Input label="الترتيب Order" type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} required />
          <Input label="رمز اللون Color" value={color} onChange={(e) => setColor(e.target.value)} required />
          <Input label="احتمالية الإغلاق %" value={winProbability} onChange={(e) => setWinProbability(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ المرحلة</Button>
        </div>
      </form>
    </Modal>
  );
}
