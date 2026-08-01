"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { workflowName: string; versionNumber: string; targetDocumentType: "Sales Order" | "Purchase Order" | "Credit Approval" }) => void;
}

export function CreateTradeWorkflowVersionsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [workflowName, setWorkflowName] = useState("");
  const [versionNumber, setVersionNumber] = useState("v1.0.0");
  const [targetDocumentType, setTargetDocumentType] = useState<"Sales Order" | "Purchase Order" | "Credit Approval">("Sales Order");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workflowName) return;
    onSubmit({ workflowName, versionNumber, targetDocumentType });
    setWorkflowName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إصدار نسخة سير عمل جديدة (Workflow Version)" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم مسار العمل" placeholder="مثال: مسار موافقات التخفيضات الاستثنائية" value={workflowName} onChange={(e) => setWorkflowName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="رقم الإصدار Version" value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} required />
          <Select
            label="نوع المستند المستهدف"
            value={targetDocumentType}
            onChange={(e) => setTargetDocumentType(e.target.value as any)}
            options={[
              { label: "أوامر المبيعات (Sales Order)", value: "Sales Order" },
              { label: "أوامر الشراء (Purchase Order)", value: "Purchase Order" },
              { label: "الموافقات الائتمانية (Credit Approval)", value: "Credit Approval" },
            ]}
          />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">نشر الإصدار الجديد</Button>
        </div>
      </form>
    </Modal>
  );
}
