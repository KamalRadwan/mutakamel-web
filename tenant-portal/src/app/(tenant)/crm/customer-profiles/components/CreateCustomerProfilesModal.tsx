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
  onSubmit: (data: { name: string; category: "VIP" | "Enterprise" | "SME"; contactPerson: string; phone: string; email: string }) => void;
}

export function CreateCustomerProfilesModal({ isOpen, onClose, onSubmit }: CreateModalProps) {
    const { t } = useI18n();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"VIP" | "Enterprise" | "SME">("Enterprise");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    onSubmit({ name, category, contactPerson, phone, email });
    setName("");
    setContactPerson("");
    setPhone("");
    setEmail("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.crm.addANewCustomerProfile} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label={t.crm.companyClientName} placeholder={t.crm.exampleAlMajdTradingCompa} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-3">
          <Select
            label={t.crm.customerRating}
            value={category}
            onChange={(e) => setCategory(e.target.value as any)}
            options={[
              { label: t.crm.vIPClients, value: "VIP" },
              { label: t.crm.majorCompaniesEnterprise, value: "Enterprise" },
              { label: t.crm.mediumEnterprisesSME, value: "SME" },
            ]}
          />
          <Input label={t.crm.directResponsible} placeholder={t.crm.professorFahd} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label={t.crm.mobileNumber} placeholder="+966 50 000 0000" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Input label={t.crm.eMail} type="email" placeholder="client@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>{t.crm.cancellation}</Button>
          <Button type="submit" variant="primary">{t.crm.saveTheClient}</Button>
        </div>
      </form>
    </Modal>
  );
}
