"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function CustomerGeneralPage() {
  const toast = useToast();
    const { t } = useI18n();
  const [name, setName] = useState(t.crm.alAmalMedicalSuppliesCompa);
  const [category, setCategory] = useState("Enterprise");
  const [contactPerson, setContactPerson] = useState(t.crm.d);
  const [phone, setPhone] = useState("+966 50 123 4567");
  const [email, setEmail] = useState("info@alamal-med.com");

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.directModificationOfTheCus}</h2>
          <p className="text-xs text-slate-500">{t.crm.updateContactInformationAnd}</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label={t.crm.companyClientName} value={name} onChange={(e) => setName(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t.crm.classification}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            options={[
              { label: t.crm.vIPClients, value: "VIP" },
              { label: t.crm.majorCompaniesEnterprise, value: "Enterprise" },
              { label: t.crm.mediumEnterprisesSME, value: "SME" },
            ]}
          />
          <Input label={t.crm.directResponsible} value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label={t.crm.mobileNumber} value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Input label={t.crm.eMail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>

        <div className="pt-2">
          <Button type="submit" variant="primary">
            <Save className="w-4 h-4" />
            <span>{t.crm.saveLiveEdits}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
