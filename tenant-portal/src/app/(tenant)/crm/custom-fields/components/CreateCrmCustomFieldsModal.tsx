"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nContext";

interface CreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { label: string; key: string; targetEntity: "lead" | "deal" | "contact" | "organization"; fieldType: "text" | "number" | "select" | "date"; isRequired: boolean }) => void;
}

export function CreateCrmCustomFieldsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [targetEntity, setTargetEntity] = useState<"lead" | "deal" | "contact" | "organization">("lead");
  const [fieldType, setFieldType] = useState<"text" | "number" | "select" | "date">("text");
  const [isRequired, setIsRequired] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label || !key) return;
    onSubmit({ label, key, targetEntity, fieldType, isRequired });
    setLabel("");
    setKey("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.addANewCustomField} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.fieldTitle} placeholder={t.crm.exampleCommercialLicenseNu} value={label} onChange={(e) => setLabel(e.target.value)} required />
        <Input label={t.crm.fieldKeyKey} placeholder="commercial_license_no" value={key} onChange={(e) => setKey(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t.crm.targetEntity}
            value={targetEntity}
            onChange={(e) => setTargetEntity(e.target.value as any)}
            options={[
              { label: t.crm.lead, value: "lead" },
              { label: t.crm.deal, value: "deal" },
              { label: t.crm.contact, value: "contact" },
              { label: t.crm.organization, value: "organization" },
            ]}
          />
          <Select
            label={t.crm.fieldType}
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as any)}
            options={[
              { label: t.crm.text, value: "text" },
              { label: t.crm.number, value: "number" },
              { label: t.crm.selectMenu, value: "select" },
              { label: t.crm.date, value: "date" },
            ]}
          />
        </div>
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="req"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
          />
          <label htmlFor="req" className="text-xs text-slate-700 dark:text-slate-300">{t.crm.requiredField}</label>
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.saveField}</Button>
        </div>
      </form>
    </Modal>
  );
}
