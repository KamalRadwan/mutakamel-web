"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nContext";
import { BranchItem } from "../hooks/useBranches";

interface CreateBranchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<BranchItem, "id" | "departmentsCount">) => void;
}

export function CreateBranchModal({ isOpen, onClose, onSubmit }: CreateBranchModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [companyName, setCompanyName] = useState("شركة متكامل القابضة للتكنولوجيا");
  const [city, setCity] = useState("الرياض");
  const [address, setAddress] = useState("");
  const [manager, setManager] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    onSubmit({
      name,
      code,
      companyName,
      city,
      address: address || "المقر الرئيسي",
      manager: manager || "غير محدد",
      phone: phone || "+966 11 000 0000",
      status,
    });
    setName("");
    setCode("");
    setAddress("");
    setManager("");
    setPhone("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.organization.createBranchModalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t.organization.branchName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label={t.organization.branchCode}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.organization.parentCompany}
          </label>
          <select
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="شركة متكامل القابضة للتكنولوجيا">شركة متكامل القابضة للتكنولوجيا</option>
            <option value="مجموعة الحلول الائتمانية الرقمية">مجموعة الحلول الائتمانية الرقمية</option>
            <option value="شركة متكامل إنترناشيونال دبي">شركة متكامل إنترناشيونال دبي</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label={t.organization.city}
            value={city}
            onChange={(e) => setCity(e.target.value)}
          />
          <Input
            label={t.organization.phone}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <Input
          label={t.organization.address}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <Input
          label={t.organization.manager}
          value={manager}
          onChange={(e) => setManager(e.target.value)}
        />
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.organization.branchStatus}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="active">{t.organization.activeBranch}</option>
            <option value="inactive">{t.organization.inactiveBranch}</option>
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
