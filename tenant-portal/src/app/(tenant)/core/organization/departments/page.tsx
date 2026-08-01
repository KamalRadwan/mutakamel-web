"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Layers, GitBranch, Users, DollarSign, UserCheck, Eye, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useDepartments, DepartmentItem } from "./hooks/useDepartments";
import { CreateDepartmentModal } from "./components/CreateDepartmentModal";

export default function DepartmentsPage() {
  const { t } = useI18n();
  const {
    items,
    rawCount,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    handleCreate,
    handleDelete,
  } = useDepartments();

  // Metrics
  const totalTeams = items.reduce((acc, d) => acc + d.teamsCount, 0);
  const totalMembers = items.reduce((acc, d) => acc + d.membersCount, 0);

  const columns = [
    {
      header: t.organization.departmentName,
      cell: (item: DepartmentItem) => (
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">{item.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: t.organization.parentBranch,
      cell: (item: DepartmentItem) => (
        <div className="flex items-center gap-1.5">
          <GitBranch className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[220px]">
            {item.branchName}
          </span>
        </div>
      ),
    },
    {
      header: t.organization.headOfDepartment,
      cell: (item: DepartmentItem) => (
        <div className="flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {item.headName}
          </span>
        </div>
      ),
    },
    {
      header: `${t.organization.allocatedBudget} / ${t.organization.teamsCount}`,
      cell: (item: DepartmentItem) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg font-mono">
            <DollarSign className="w-3 h-3" />
            {item.budgetAllocated}
          </span>
          <Badge variant="info" className="gap-1">
            <Users className="w-3 h-3" />
            {item.teamsCount} {t.organization.teamsCount} ({item.membersCount} {t.organization.employeesCount})
          </Badge>
        </div>
      ),
    },
    {
      header: t.common.status,
      cell: (item: DepartmentItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? t.common.active : t.common.inactive}
        </Badge>
      ),
    },
    {
      header: t.common.actions,
      cell: (item: DepartmentItem) => (
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" title={t.organization.viewDeptDetails}>
            <Eye className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} title={t.organization.deleteDept}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.organization.departmentsTitle}
        subtitle={t.organization.departmentsSubtitle}
        actionLabel={t.organization.addDepartment}
        onAction={() => setIsCreateOpen(true)}
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-200/50 dark:border-purple-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.totalDepartments}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{rawCount} {t.organization.departmentsCount}</h3>
          </div>
          <div className="p-3 rounded-xl bg-purple-500 text-white shadow-lg shadow-purple-500/30">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent border border-blue-200/50 dark:border-blue-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.teamsCount}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalTeams} {t.organization.teamsCount}</h3>
          </div>
          <div className="p-3 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-200/50 dark:border-emerald-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.workforce}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalMembers} {t.organization.employeesCount}</h3>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* Table */}
      <Table columns={columns} data={items} />

      {/* Create Modal */}
      <CreateDepartmentModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
