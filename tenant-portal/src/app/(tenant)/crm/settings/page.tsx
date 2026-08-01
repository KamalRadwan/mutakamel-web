"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Sliders, Settings2, ShieldCheck } from "lucide-react";
import { useCrmModuleSettings, CrmModuleSettingItem } from "./hooks/useCrmModuleSettings";
import { CreateCrmModuleSettingsModal } from "./components/CreateCrmModuleSettingsModal";
import { DeleteCrmModuleSettingsConfirmModal } from "./components/DeleteCrmModuleSettingsConfirmModal";
import { useI18n } from "@/i18n/I18nContext";

export default function CrmModuleSettingsPage() {
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
  } = useCrmModuleSettings();

  const columns = [
    {
      header: t.crm.settingName,
      cell: (item: CrmModuleSettingItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.settingName}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.key}</p>
          </div>
        </div>
      ),
    },
    {
      header: t.crm.theAssignedValue,
      cell: (item: CrmModuleSettingItem) => (
        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{item.value}</span>
      ),
    },
    {
      header: t.crm.group,
      cell: (item: CrmModuleSettingItem) => (
        <Badge variant="info">{item.group.toUpperCase()}</Badge>
      ),
    },
    {
      header: t.crm.theCondition,
      cell: (item: CrmModuleSettingItem) => (
        <Badge variant="success">{t.crm.activeAndApplied}</Badge>
      ),
    },
    {
      header: t.crm.procedures,
      cell: (item: CrmModuleSettingItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/settings/${item.id}/general`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setSelectedForDelete(item)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.crm.cRMGeneralSettingsModule}
        subtitle={t.crm.customizeAutomatedDistributi}
        actionLabel={t.crm.addANewSetting}
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={t.crm.searchBySettingKeyOrVal}
      />

      <Table columns={columns} data={items} />

      <CreateCrmModuleSettingsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCrmModuleSettingsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
