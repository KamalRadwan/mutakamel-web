"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { GitBranch, MapPin, Building2, UserCheck, Layers, Phone, Eye, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useBranches, BranchItem } from "./hooks/useBranches";
import { CreateBranchModal } from "./components/CreateBranchModal";

export default function BranchesPage() {
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
  } = useBranches();

  // Metrics
  const citiesCount = new Set(items.map((i) => i.city)).size;
  const totalDepts = items.reduce((acc, b) => acc + b.departmentsCount, 0);

  const columns = [
    {
      header: t.organization.branchName,
      cell: (item: BranchItem) => (
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
            <GitBranch className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">{item.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: t.organization.parentCompany,
      cell: (item: BranchItem) => (
        <div className="flex items-center gap-1.5">
          <Building2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
            {item.companyName}
          </span>
        </div>
      ),
    },
    {
      header: `${t.organization.city} / ${t.organization.address}`,
      cell: (item: BranchItem) => (
        <div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5 text-rose-500" />
            {item.city}
          </p>
          <p className="text-[11px] text-slate-400 truncate max-w-[180px]">{item.address}</p>
        </div>
      ),
    },
    {
      header: `${t.organization.manager} / ${t.organization.phone}`,
      cell: (item: BranchItem) => (
        <div>
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
            {item.manager}
          </p>
          <p className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <Phone className="w-3 h-3 text-slate-400" />
            {item.phone}
          </p>
        </div>
      ),
    },
    {
      header: t.organization.totalDepts,
      cell: (item: BranchItem) => (
        <Badge variant="info" className="gap-1">
          <Layers className="w-3 h-3" />
          {item.departmentsCount} {t.organization.departmentsCount}
        </Badge>
      ),
    },
    {
      header: t.common.status,
      cell: (item: BranchItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? t.common.active : t.common.inactive}
        </Badge>
      ),
    },
    {
      header: t.common.actions,
      cell: (item: BranchItem) => (
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" title={t.organization.viewBranchDetails}>
            <Eye className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} title={t.organization.deleteBranch}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.organization.branchesTitle}
        subtitle={t.organization.branchesSubtitle}
        actionLabel={t.organization.addBranch}
        onAction={() => setIsCreateOpen(true)}
      />

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-200/50 dark:border-emerald-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.totalBranches}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{rawCount} {t.organization.branchesCount}</h3>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <GitBranch className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-rose-500/10 via-pink-500/5 to-transparent border border-rose-200/50 dark:border-rose-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.city}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{citiesCount}</h3>
          </div>
          <div className="p-3 rounded-xl bg-rose-500 text-white shadow-lg shadow-rose-500/30">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent border border-blue-200/50 dark:border-blue-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.totalDepts}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalDepts}</h3>
          </div>
          <div className="p-3 rounded-xl bg-blue-500 text-white shadow-lg shadow-blue-500/30">
            <Layers className="w-5 h-5" />
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
      <CreateBranchModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
