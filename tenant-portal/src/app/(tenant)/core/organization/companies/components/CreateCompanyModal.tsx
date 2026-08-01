"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CountrySelect } from "@/components/shared/CountrySelect";
import { useI18n } from "@/i18n/I18nContext";
import { CompanyItem } from "../hooks/useCompanies";

interface CreateCompanyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<CompanyItem, "id" | "branchesCount" | "departmentsCount" | "employeesCount" | "createdAt">) => void;
}

const TENANT_CURRENCIES = [
  { code: "SAR", name: "SAR - ريال سعودي" },
  { code: "USD", name: "USD - US Dollar" },
  { code: "EUR", name: "EUR - Euro" },
  { code: "AED", name: "AED - درهم إماراتي" },
  { code: "KWD", name: "KWD - دينار كويتي" },
  { code: "BHD", name: "BHD - دينار بحريني" },
  { code: "QAR", name: "QAR - ريال قطري" },
  { code: "OMR", name: "OMR - ريال عماني" },
  { code: "EGP", name: "EGP - جنيه مصري" },
];

export function CreateCompanyModal({ isOpen, onClose, onSubmit }: CreateCompanyModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [crNumber, setCrNumber] = useState("");
  const [taxId, setTaxId] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [country, setCountry] = useState("SA");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    onSubmit({
      name,
      code,
      crNumber: crNumber || "1010000000",
      taxId: taxId || "300000000000003",
      currency,
      country,
      status,
    });
    setName("");
    setCode("");
    setCrNumber("");
    setTaxId("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.organization.createCompanyModalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t.organization.companyName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label={t.organization.companyCode}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label={t.organization.crNumber}
            value={crNumber}
            onChange={(e) => setCrNumber(e.target.value)}
          />
          <Input
            label={t.organization.taxId}
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              {t.organization.mainCurrency}
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {TENANT_CURRENCIES.map((curr) => (
                <option key={curr.code} value={curr.code}>
                  {curr.name}
                </option>
              ))}
            </select>
          </div>
          <CountrySelect
            value={country}
            onChange={(isoCode) => setCountry(isoCode)}
            label={t.organization.country}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.organization.companyStatus}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="active">{t.organization.activeCompany}</option>
            <option value="inactive">{t.organization.inactiveCompany}</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.common.cancel}
          </Button>
          <Button type="submit" variant="primary">
            {t.common.create}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
