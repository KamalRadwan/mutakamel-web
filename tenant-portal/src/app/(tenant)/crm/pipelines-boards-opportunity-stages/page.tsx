"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Kanban } from "lucide-react";
import { usePipelinesBoards, PipelineBoardItem } from "./hooks/usePipelinesBoards";
import { CreatePipelinesBoardsModal } from "./components/CreatePipelinesBoardsModal";
import { DeletePipelinesBoardsConfirmModal } from "./components/DeletePipelinesBoardsConfirmModal";

export default function PipelinesBoardsPage() {
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
  } = usePipelinesBoards();

  const columns = [
    {
      header: t.crm.pathBoardName,
      cell: (item: PipelineBoardItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <Kanban className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: t.crm.numberOfStages,
      cell: (item: PipelineBoardItem) => (
        <Badge variant="info">{item.stagesCount} {t.crm.stages}</Badge>
      ),
    },
    {
      header: t.crm.totalValueOfTransactions,
      cell: (item: PipelineBoardItem) => (
        <span className="font-bold text-emerald-600">{item.totalDealsValue}</span>
      ),
    },
    {
      header: t.crm.theCondition,
      cell: (item: PipelineBoardItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? t.crm.activeAndUsed : t.crm.archived}
        </Badge>
      ),
    },
    {
      header: t.crm.procedures,
      cell: (item: PipelineBoardItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/pipelines-boards-opportunity-stages/${item.id}/general`}>
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
        title={t.crm.pipelinesKanbanBoards}
        subtitle={t.crm.buildInteractiveKanbanStyle}
        actionLabel={t.crm.createANewSalesFunnel}
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={t.crm.searchByPathNameOrCode}
      />

      <Table columns={columns} data={items} />

      <CreatePipelinesBoardsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeletePipelinesBoardsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
