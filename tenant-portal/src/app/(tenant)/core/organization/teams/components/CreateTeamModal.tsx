"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/i18n/I18nContext";
import { TeamItem } from "../hooks/useTeams";

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Omit<TeamItem, "id">) => void;
}

export function CreateTeamModal({ isOpen, onClose, onSubmit }: CreateTeamModalProps) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [departmentName, setDepartmentName] = useState("إدارة تقنية المعلومات والحلول السحابية");
  const [leaderName, setLeaderName] = useState("");
  const [membersCount, setMembersCount] = useState("5");
  const [specialty, setSpecialty] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) return;
    onSubmit({
      name,
      code,
      departmentName,
      leaderName: leaderName || "غير محدد",
      membersCount: parseInt(membersCount) || 1,
      specialty: specialty || "عام",
      status,
    });
    setName("");
    setCode("");
    setLeaderName("");
    setSpecialty("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t.organization.createTeamModalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label={t.organization.teamName}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label={t.organization.teamCode}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.organization.parentDepartment}
          </label>
          <select
            value={departmentName}
            onChange={(e) => setDepartmentName(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="إدارة تقنية المعلومات والحلول السحابية">إدارة تقنية المعلومات والحلول السحابية</option>
            <option value="إدارة المبيعات والتوسع التجاري">إدارة المبيعات والتوسع التجاري</option>
            <option value="إدارة الموارد البشرية والعمليات">إدارة الموارد البشرية والعمليات</option>
            <option value="إدارة الموائمة المالية والمخاطر">إدارة الموائمة المالية والمخاطر</option>
            <option value="إدارة التسويق والتواصل المؤسسي">إدارة التسويق والتواصل المؤسسي</option>
          </select>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label={t.organization.teamLeader}
            value={leaderName}
            onChange={(e) => setLeaderName(e.target.value)}
          />
          <Input
            label={t.organization.teamMembersCount}
            type="number"
            value={membersCount}
            onChange={(e) => setMembersCount(e.target.value)}
          />
        </div>
        <Input
          label={t.organization.specialty}
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
        />
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            {t.organization.teamStatus}
          </label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
            className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="active">{t.organization.activeTeam}</option>
            <option value="inactive">{t.organization.inactiveTeam}</option>
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
