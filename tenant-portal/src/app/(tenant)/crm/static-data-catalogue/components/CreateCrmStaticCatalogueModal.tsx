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
  onSubmit: (data: { catalogName: string; category: "lead_sources" | "industry_types" | "deal_reasons" | "currencies" }) => void;
}

export function CreateCrmStaticCatalogueModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [catalogName, setCatalogName] = useState("");
  const [category, setCategory] = useState<"lead_sources" | "industry_types" | "deal_reasons" | "currencies">("industry_types");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalogName) return;
    onSubmit({ catalogName, category });
    setCatalogName("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.addingAStaticDataCatalogT} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.catalogReferenceListName} placeholder={t.crm.exampleGuideToMedicalAnd} value={catalogName} onChange={(e) => setCatalogName(e.target.value)} required />
        <Select
          label={t.crm.referenceClassification}
          value={category}
          onChange={(e) => setCategory(e.target.value as any)}
          options={[
            { label: t.crm.industryTypes, value: "industry_types" },
            { label: t.crm.dealLostReasons, value: "deal_reasons" },
            { label: t.crm.leadSources, value: "lead_sources" },
          ]}
        />
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.saveTheCatalog}</Button>
        </div>
      </form>
    </Modal>
  );
}
