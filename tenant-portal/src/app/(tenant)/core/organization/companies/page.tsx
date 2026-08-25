"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Building2, GitBranch, Layers, Users, Eye, Trash2, Globe } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useCompanies, CompanyItem } from "./hooks/useCompanies";
import { CreateCompanyModal } from "./components/CreateCompanyModal";

export default function CompaniesPage() {
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
  } = useCompanies();

  // Metric totals
  const totalBranches = items.reduce((acc, c) => acc + c.branchesCount, 0);
  const totalDepts = items.reduce((acc, c) => acc + c.departmentsCount, 0);
  const totalEmp = items.reduce((acc, c) => acc + c.employeesCount, 0);

  const columns = [
    {
      header: t.organization.companyName,
      cell: (item: CompanyItem) => (
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
              {item.code} · {t.organization.crLabel}: {item.crNumber}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: `${t.organization.taxId} / ${t.organization.country}`,
      cell: (item: CompanyItem) => (
        <div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
            <Globe className="w-3.5 h-3.5 text-blue-500" />
            {item.country}
          </p>
          <p className="text-[11px] text-slate-400 font-mono">{t.organization.taxLabel}: {item.taxId}</p>
        </div>
      ),
    },
    {
      header: t.nav.organization,
      cell: (item: CompanyItem) => (
        <div className="flex items-center gap-2">
          <Badge variant="info" className="gap-1">
            <GitBranch className="w-3 h-3" />
            {item.branchesCount} {t.organization.branchesCount}
          </Badge>
          <Badge variant="neutral" className="gap-1">
            <Layers className="w-3 h-3" />
            {item.departmentsCount} {t.organization.departmentsCount}
          </Badge>
        </div>
      ),
    },
    {
      header: `${t.organization.workforce} / ${t.organization.mainCurrency}`,
      cell: (item: CompanyItem) => (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg">
            <Users className="w-3.5 h-3.5" />
            {item.employeesCount} {t.organization.employeesCount}
          </span>
          <span className="text-xs font-bold font-mono px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-700 dark:text-slate-300">
            {item.currency}
          </span>
        </div>
      ),
    },
    {
      header: t.common.status,
      cell: (item: CompanyItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? t.common.active : t.common.inactive}
        </Badge>
      ),
    },
    {
      header: t.common.actions,
      cell: (item: CompanyItem) => (
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" title={t.organization.viewDetails}>
            <Eye className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} title={t.organization.deleteCompany}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.organization.companiesTitle}
        subtitle={t.organization.companiesSubtitle}
        actionLabel={t.organization.addCompany}
        onAction={() => setIsCreateOpen(true)}
      />

      {/* KPI Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-transparent border border-blue-200/50 dark:border-blue-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.totalCompanies}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{rawCount}</h3>
          </div>
          <div className="p-3 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-200/50 dark:border-emerald-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.subBranches}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalBranches}</h3>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <GitBranch className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent border border-purple-200/50 dark:border-purple-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.totalDepts}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalDepts}</h3>
          </div>
          <div className="p-3 rounded-xl bg-purple-500 text-white shadow-lg shadow-purple-500/30">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200/50 dark:border-amber-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.workforce}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalEmp} {t.organization.employeesCount}</h3>
          </div>
          <div className="p-3 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* High-density Data Table */}
      <Table columns={columns} data={items} />

      {/* Create Company Modal */}
      <CreateCompanyModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
