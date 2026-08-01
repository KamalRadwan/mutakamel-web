"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, LayoutTemplate, Layers, ShieldCheck } from "lucide-react";
import { usePresetDashboards, PresetDashboardItem } from "./hooks/usePresetDashboards";
import { CreatePresetDashboardsModal } from "./components/CreatePresetDashboardsModal";
import { DeletePresetDashboardsConfirmModal } from "./components/DeletePresetDashboardsConfirmModal";
import { useI18n } from "@/i18n/I18nContext";

export default function PresetDashboardsPage() {
//     const { t } = useI18n();
  const {
    t,
    items,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
  } = usePresetDashboards();

  const columns = [
    {
      header: t.crm.presetName,
      cell: (item: PresetDashboardItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <LayoutTemplate className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] text-slate-400">{t.crm.numberOfWidgets}{item.widgetsCount}</p>
          </div>
        </div>
      ),
    },
    {
      header: t.crm.classification,
      cell: (item: PresetDashboardItem) => (
        <Badge variant="info">{item.category.toUpperCase()}</Badge>
      ),
    },
    {
      header: t.crm.plateType,
      cell: (item: PresetDashboardItem) => (
        <Badge variant={item.isSystemPreset ? "success" : "neutral"}>
          {item.isSystemPreset ? t.crm.systemDefault : t.crm.dedicatedToTheBranch}
        </Badge>
      ),
    },
    {
      header: t.crm.theCondition,
      cell: (item: PresetDashboardItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? t.crm.activated : t.crm.archived}
        </Badge>
      ),
    },
    {
      header: t.crm.procedures,
      cell: (item: PresetDashboardItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/dashboards/${item.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          {!item.isSystemPreset && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedForDelete(item)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.crm.presetDashboardsAndTemplate}
        subtitle={t.crm.preBuiltAnalyticalTemplates}
        actionLabel={t.crm.createANewReadyPanel}
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={t.crm.searchByPresetNameOrCateg}
      />

      <Table columns={columns} data={items} />

      <CreatePresetDashboardsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeletePresetDashboardsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
