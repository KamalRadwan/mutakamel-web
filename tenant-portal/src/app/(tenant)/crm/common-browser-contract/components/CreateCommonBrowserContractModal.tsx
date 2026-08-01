"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { ruleName: string; envelopeStructure: string; errorCategory: string; statusCode: number }) => void;
}

export function CreateCommonBrowserContractModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [ruleName, setRuleName] = useState("");
  const [envelopeStructure, setEnvelopeStructure] = useState("{ success, data, meta }");
  const [errorCategory, setErrorCategory] = useState("VALIDATION");
  const [statusCode, setStatusCode] = useState(200);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName) return;
    onSubmit({ ruleName, envelopeStructure, errorCategory, statusCode: Number(statusCode) });
    setRuleName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="تعريف قاعدة عقد المتصفح العامة (Browser Contract)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم القاعدة / الشرط" placeholder="مثال: الغلاف الموحد للاستجابة" value={ruleName} onChange={(e) => setRuleName(e.target.value)} required />
        <Input label="هيكل الغلاف Envelope Structure" value={envelopeStructure} onChange={(e) => setEnvelopeStructure(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="تصنيف الخطأ" value={errorCategory} onChange={(e) => setErrorCategory(e.target.value)} required />
          <Input label="كود الـ HTTP" type="number" value={statusCode} onChange={(e) => setStatusCode(Number(e.target.value))} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ القاعدة</Button>
        </div>
      </form>
    </Modal>
  );
}
