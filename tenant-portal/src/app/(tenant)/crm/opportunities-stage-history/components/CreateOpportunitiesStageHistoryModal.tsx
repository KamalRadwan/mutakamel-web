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
  onSubmit: (data: { title: string; customerName: string; amount: string; currency: string; currentStage: string; assignedOwner: string; expectedCloseDate: string }) => void;
}

export function CreateOpportunitiesStageHistoryModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState(t.crm.alAmalMedicalSuppliesCompa);
  const [amount, setAmount] = useState("250000.00");
  const [currency, setCurrency] = useState("SAR");
  const [currentStage, setCurrentStage] = useState(t.crm.submittingTheTechnicalOffer);
  const [assignedOwner, setAssignedOwner] = useState(t.crm.ahmedMahmoud);
  const [expectedCloseDate, setExpectedCloseDate] = useState("2026-08-30");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;
    onSubmit({ title, customerName, amount, currency, currentStage, assignedOwner, expectedCloseDate });
    setTitle("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.addANewBusinessOpportunity} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.opportunityDealTitle} placeholder={t.crm.exampleSupplyAndCustomizat} value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Input label={t.crm.customerName} value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t.crm.opportunityValue} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          <Select
            label={t.crm.currency}
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            options={[
              { label: t.crm.sARSAR, value: "SAR" },
              { label: "USD ($)", value: "USD" },
            ]}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select
            label={t.crm.firstStage}
            value={currentStage}
            onChange={(e) => setCurrentStage(e.target.value)}
            options={[
              { label: t.crm.submittingTheTechnicalOffer, value: t.crm.submittingTheTechnicalOffer },
              { label: t.crm.finalNegotiations, value: t.crm.finalNegotiations },
            ]}
          />
          <Input label={t.crm.transactionOfficial} value={assignedOwner} onChange={(e) => setAssignedOwner(e.target.value)} required />
          <Input label={t.crm.expectedClosingDate} value={expectedCloseDate} onChange={(e) => setExpectedCloseDate(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.saveTheOpportunity}</Button>
        </div>
      </form>
    </Modal>
  );
}
