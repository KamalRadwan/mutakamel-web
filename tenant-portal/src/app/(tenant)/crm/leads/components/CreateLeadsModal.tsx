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
  onSubmit: (data: { leadName: string; company: string; email: string; phone: string; source: string; stage: string; assignedTo: string }) => void;
}

export function CreateLeadsModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [leadName, setLeadName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("Google Ads");
  const [stage, setStage] = useState(t.crm.newPotentialClient);
  const [assignedTo, setAssignedTo] = useState(t.crm.ahmedMahmoud);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadName || !company) return;
    onSubmit({ leadName, company, email, phone, source, stage, assignedTo });
    setLeadName("");
    setCompany("");
    setEmail("");
    setPhone("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.addANewLead} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.nameOfPotentialCustomer} placeholder={t.crm.exampleDr} value={leadName} onChange={(e) => setLeadName(e.target.value)} required />
        <Input label={t.crm.nameOfTheCompanyEntity} placeholder={t.crm.alHayatHospital} value={company} onChange={(e) => setCompany(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Input label={t.crm.eMail} type="email" placeholder="lead@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label={t.crm.mobileNumber} placeholder="+966 50 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Select
            label={t.crm.sourceOfPolarization}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            options={[
              { label: "Google Ads", value: "Google Ads" },
              { label: t.crm.healthExpo2026, value: t.crm.healthExpo2026 },
              { label: "Referral", value: "Referral" },
            ]}
          />
          <Select
            label={t.crm.initialStage}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            options={[
              { label: t.crm.newPotentialClient, value: t.crm.newPotentialClient },
              { label: t.crm.communicatedAndQualified, value: t.crm.communicatedAndQualified },
            ]}
          />
          <Input label={t.crm.salesOfficer} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.saveThePotentialCustomer}</Button>
        </div>
      </form>
    </Modal>
  );
}
