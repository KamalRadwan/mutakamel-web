"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { profileName: string; documentCategory: "tax_invoice" | "customs_declaration" | "bill_of_lading" | "certificate_origin"; zatcaPhase: "Phase 1" | "Phase 2 Clearance" | "Phase 2 Reporting" }) => void;
}

export function CreateTradeDocumentProfileModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [profileName, setProfileName] = useState("");
  const [documentCategory, setDocumentCategory] = useState<"tax_invoice" | "customs_declaration" | "bill_of_lading" | "certificate_origin">("tax_invoice");
  const [zatcaPhase, setZatcaPhase] = useState<"Phase 1" | "Phase 2 Clearance" | "Phase 2 Reporting">("Phase 2 Reporting");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileName) return;
    onSubmit({ profileName, documentCategory, zatcaPhase });
    setProfileName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة بروفايل مستندات تجارية (Document Profile)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم البروفايل" placeholder="مثال: بروفايل الفاتورة التصديرية" value={profileName} onChange={(e) => setProfileName(e.target.value)} required />
        <Select
          label="فئة المستند Document Category"
          value={documentCategory}
          onChange={(e) => setDocumentCategory(e.target.value as typeof documentCategory)}
          options={[
            { label: "فاتورة ضريبية (Tax Invoice)", value: "tax_invoice" },
            { label: "بيان جمركي (Customs Declaration)", value: "customs_declaration" },
            { label: "بوليصة شحن (Bill of Lading)", value: "bill_of_lading" },
            { label: "شهادة منشأ (Certificate of Origin)", value: "certificate_origin" },
          ]}
        />
        <Select
          label="مرحلة الربط مع هيئة الزكاة (ZATCA)"
          value={zatcaPhase}
          onChange={(e) => setZatcaPhase(e.target.value as typeof zatcaPhase)}
          options={[
            { label: "Phase 1 (توليد QR فقط)", value: "Phase 1" },
            { label: "Phase 2 Clearance (الفسح المسبق)", value: "Phase 2 Clearance" },
            { label: "Phase 2 Reporting (الإبلاغ الآلي)", value: "Phase 2 Reporting" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ البروفايل</Button>
        </div>
      </form>
    </Modal>
  );
}
