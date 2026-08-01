"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Target, History, DollarSign } from "lucide-react";
import { useOpportunitiesStageHistory, OpportunityItem } from "./hooks/useOpportunitiesStageHistory";
import { CreateOpportunitiesStageHistoryModal } from "./components/CreateOpportunitiesStageHistoryModal";
import { DeleteOpportunitiesStageHistoryConfirmModal } from "./components/DeleteOpportunitiesStageHistoryConfirmModal";
import { useI18n } from "@/i18n/I18nContext";

export default function OpportunitiesStageHistoryPage() {
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
  } = useOpportunitiesStageHistory();

  const columns = [
    {
      header: t.crm.businessOpportunityAndClien,
      cell: (item: OpportunityItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
            <p className="text-[11px] text-slate-400">{item.customerName}</p>
          </div>
        </div>
      ),
    },
    {
      header: t.crm.suppliedValue,
      cell: (item: OpportunityItem) => (
        <span className="font-bold text-emerald-600">{item.amount} {item.currency}</span>
      ),
    },
    {
      header: t.crm.currentStage,
      cell: (item: OpportunityItem) => (
        <Badge variant={item.status === "won" ? "success" : "info"}>{item.currentStage}</Badge>
      ),
    },
    { header: t.crm.previousStage, accessorKey: "previousStage" as keyof OpportunityItem },
    { header: t.crm.responsible, accessorKey: "assignedOwner" as keyof OpportunityItem },
    {
      header: t.crm.procedures,
      cell: (item: OpportunityItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/opportunities-stage-history/${item.id}/general`}>
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
        title={t.crm.businessOpportunitiesAndTra}
        subtitle={t.crm.manageOpenAndClosedOpportu}
        actionLabel={t.crm.addANewOpportunity}
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={t.crm.searchByTitleClientName}
      />

      <Table columns={columns} data={items} />

      <CreateOpportunitiesStageHistoryModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteOpportunitiesStageHistoryConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
