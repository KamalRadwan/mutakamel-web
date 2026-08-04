"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastContext";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Save } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";

export default function LeadGeneralPage() {
  const toast = useToast();
    const { t } = useI18n();
  const [leadName, setLeadName] = useState(t.crm.d);
  const [company, setCompany] = useState(t.crm.alHayatSpecializedHospital);
  const [email, setEmail] = useState("dr.maliki@alhayat.sa");
  const [phone, setPhone] = useState("+966 50 888 9999");
  const [stage, setStage] = useState(t.crm.submittingTheTechnicalOffer);
  const [assignedTo, setAssignedTo] = useState(t.crm.ahmedMahmoud);

  const handleInlineSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.saved();
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.directModificationToThePot}</h2>
          <p className="text-xs text-slate-500">{t.crm.updateNameCompanyAndStage}</p>
        </div>
      </div>

      <form onSubmit={handleInlineSave} className="space-y-4 max-w-2xl">
        <Input label={t.crm.nameOfPotentialCustomer} value={leadName} onChange={(e) => setLeadName(e.target.value)} required />
        <Input label={t.crm.company} value={company} onChange={(e) => setCompany(e.target.value)} required />
        <div className="grid grid-cols-2 gap-4">
          <Input label={t.crm.eMail} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label={t.crm.mobileNumber} value={phone} onChange={(e) => setPhone(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t.crm.currentStage}
            value={stage}
            onChange={(e) => setStage(e.target.value)}
            options={[
              { label: t.crm.submittingTheTechnicalOffer, value: t.crm.submittingTheTechnicalOffer },
              { label: t.crm.communicatedAndQualified, value: t.crm.communicatedAndQualified },
            ]}
          />
          <Input label={t.crm.salesOfficer} value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required />
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
