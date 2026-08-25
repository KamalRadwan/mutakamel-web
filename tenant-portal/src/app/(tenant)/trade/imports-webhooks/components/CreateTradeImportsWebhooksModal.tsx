"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; type: "excel_import" | "webhook_listener" | "outbound_webhook"; targetEndpointOrFile: string }) => void;
}

export function CreateTradeImportsWebhooksModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"excel_import" | "webhook_listener" | "outbound_webhook">("outbound_webhook");
  const [targetEndpointOrFile, setTargetEndpointOrFile] = useState("https://api.external.com/webhook");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, type, targetEndpointOrFile });
    setName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="إضافة مهمة استيراد أو رابط Webhook" maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="اسم العملية / الرابط" placeholder="مثال: إشعار الشحن الخارجي" value={name} onChange={(e) => setName(e.target.value)} required />
        <Select
          label="النوع Type"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          options={[
            { label: "رابط صادر (Outbound Webhook)", value: "outbound_webhook" },
            { label: "رابط مستقبِل (Webhook Listener)", value: "webhook_listener" },
            { label: "استيراد ملفات (Excel/CSV Import)", value: "excel_import" },
          ]}
        />
        <Input label="الرابط Target URL / اسم الملف" value={targetEndpointOrFile} onChange={(e) => setTargetEndpointOrFile(e.target.value)} required />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>إلغاء</Button>
          <Button type="submit" variant="primary">حفظ الإجراء</Button>
        </div>
      </form>
    </Modal>
  );
}
