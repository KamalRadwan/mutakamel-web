"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nContext";
import { DepartmentItem } from "../hooks/useDepartments";

interface CreateDepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<DepartmentItem, "id" | "teamsCount" | "membersCount">) => void;
}

export function CreateDepartmentModal({ isOpen, onClose, onSubmit }: CreateDepartmentModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [branchName, setBranchName] = useState("فرع الرياض الرئيسي - العليا");
  const [headName, setHeadName] = useState("");
  const [budgetAllocated, setBudgetAllocated] = useState("500,000 SAR");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    onSubmit({
      name,
      code,
      branchName,
      headName: headName || "غير محدد",
      budgetAllocated: budgetAllocated || "0 SAR",
      status,
    });
    setName("");
    setCode("");
    setHeadName("");
    setBudgetAllocated("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.organization.createDepartmentModalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t.organization.departmentName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label={t.organization.departmentCode}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.organization.parentBranch}
          </label>
          <select
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="فرع الرياض الرئيسي - العليا">فرع الرياض الرئيسي - العليا</option>
            <option value="فرع جدة الإقليمي - الشاطئ">فرع جدة الإقليمي - الشاطئ</option>
            <option value="فرع الخبر والمنطقة الشرقية">فرع الخبر والمنطقة الشرقية</option>
            <option value="فرع دبي المالي - DIFC">فرع دبي المالي - DIFC</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label={t.organization.headOfDepartment}
            value={headName}
            onChange={(e) => setHeadName(e.target.value)}
          />
          <Input
            label={t.organization.allocatedBudget}
            value={budgetAllocated}
            onChange={(e) => setBudgetAllocated(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.organization.departmentStatus}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="active">{t.organization.activeDept}</option>
            <option value="inactive">{t.organization.inactiveDept}</option>
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
