"use client";

import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Users, Layers, UserCheck, Sparkles, Eye, Trash2 } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useTeams, TeamItem } from "./hooks/useTeams";
import { CreateTeamModal } from "./components/CreateTeamModal";

export default function TeamsPage() {
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
  } = useTeams();

  // Metrics
  const totalMembers = items.reduce((acc, t) => acc + t.membersCount, 0);
  const specialtiesCount = new Set(items.map((i) => i.specialty)).size;

  const columns = [
    {
      header: t.organization.teamName,
      cell: (item: TeamItem) => (
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/20">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
              {item.code} · {t.organization.specialty}: {item.specialty}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: t.organization.parentDepartment,
      cell: (item: TeamItem) => (
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-purple-500 shrink-0" />
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate max-w-[220px]">
            {item.departmentName}
          </span>
        </div>
      ),
    },
    {
      header: t.organization.teamLeader,
      cell: (item: TeamItem) => (
        <div className="flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {item.leaderName}
          </span>
        </div>
      ),
    },
    {
      header: t.organization.teamMembersCount,
      cell: (item: TeamItem) => (
        <Badge variant="info" className="gap-1">
          <Users className="w-3 h-3" />
          {item.membersCount} {t.organization.membersCount}
        </Badge>
      ),
    },
    {
      header: t.common.status,
      cell: (item: TeamItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? t.common.active : t.common.inactive}
        </Badge>
      ),
    },
    {
      header: t.common.actions,
      cell: (item: TeamItem) => (
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" title={t.organization.viewTeamDetails}>
            <Eye className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)} title={t.organization.deleteTeam}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.organization.teamsTitle}
        subtitle={t.organization.teamsSubtitle}
        actionLabel={t.organization.addTeam}
        onAction={() => setIsCreateOpen(true)}
      />

      {/* KPI Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-orange-500/5 to-transparent border border-amber-200/50 dark:border-amber-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.totalTeams}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{rawCount} {t.organization.teamsCount}</h3>
          </div>
          <div className="p-3 rounded-xl bg-amber-500 text-white shadow-lg shadow-amber-500/30">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent border border-emerald-200/50 dark:border-emerald-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.teamMembersCount}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{totalMembers} {t.organization.membersCount}</h3>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-200/50 dark:border-indigo-800/30 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t.organization.specialty}</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">{specialtiesCount}</h3>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
            <Sparkles className="w-5 h-5" />
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
      <CreateTeamModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
