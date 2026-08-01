"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { documentType: "invoice" | "quotation" | "purchase_order" | "dispatch_note"; referenceNumber: string; templateName: string }) => void;
}

export function CreateTradePdfRenderJobsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [documentType, setDocumentType] = useState<"invoice" | "quotation" | "purchase_order" | "dispatch_note">("invoice");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [templateName, setTemplateName] = useState("ZATCA_Tax_Invoice_Standard.html");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!referenceNumber) return;
    onSubmit({ documentType, referenceNumber, templateName });
    setReferenceNumber("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إرسال طلب رندر PDF للمستندات التجارية" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="نوع المستند"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value as any)}
          options={[
            { label: "فاتورة ضريبية (Tax Invoice)", value: "invoice" },
            { label: "عرض سعر (Quotation)", value: "quotation" },
            { label: "أمر شراء (Purchase Order)", value: "purchase_order" },
            { label: "إذن تسليم (Dispatch Note)", value: "dispatch_note" },
          ]}
        />
        <Input label="رقم المستند المرجعي" placeholder="مثال: INV-2026-9900" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} required />
        <Input label="قالب الطباعة HTML Template" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">إرسال مهمة الطباعة</Button>
        </div>
      </form>
    </Modal>
  );
}
