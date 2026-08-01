"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, LayoutGrid, BarChart2, PieChart } from "lucide-react";
import { useCrmDashboardBuilder, WidgetItem } from "./hooks/useCrmDashboardBuilder";
import { CreateCrmDashboardBuilderModal } from "./components/CreateCrmDashboardBuilderModal";
import { DeleteCrmDashboardBuilderConfirmModal } from "./components/DeleteCrmDashboardBuilderConfirmModal";
import { useI18n } from "@/i18n/I18nContext";

export default function CrmDashboardBuilderPage() {
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
  } = useCrmDashboardBuilder();

  const columns = [
    {
      header: t.crm.widgetName,
      cell: (item: WidgetItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
            <LayoutGrid className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] text-slate-400">{item.metric}</p>
          </div>
        </div>
      ),
    },
    {
      header: t.crm.displayTypeVisual,
      cell: (item: WidgetItem) => (
        <Badge variant="info">{item.type.toUpperCase()}</Badge>
      ),
    },
    { header: t.crm.automatedUpdate, accessorKey: "refreshInterval" as keyof WidgetItem },
    {
      header: t.crm.hypothetical,
      cell: (item: WidgetItem) => (
        <Badge variant={item.isDefault ? "success" : "neutral"}>
          {item.isDefault ? t.crm.onTheMainBoard : t.crm.custom}
        </Badge>
      ),
    },
    {
      header: t.crm.procedures,
      cell: (item: WidgetItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/dashboard-builder-widgets/${item.id}/general`}>
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
        title={t.crm.customDashboardBuilderWid}
        subtitle={t.crm.buildAndCustomizeGraphical}
        actionLabel={t.crm.addNewWidget}
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={t.crm.searchByTheNameOfTheWidg}
      />

      <Table columns={columns} data={items} />

      <CreateCrmDashboardBuilderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCrmDashboardBuilderConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
