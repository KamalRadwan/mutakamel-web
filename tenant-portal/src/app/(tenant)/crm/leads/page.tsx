"use client";

import { useMemo } from "react";
import { Mail, Phone, Share2, Trash2 } from "lucide-react";
import {
  Badge,
  type BadgeProps,
  BoardView,
  Button,
  type BoardColumnDef,
  CardView,
  type ColumnDef,
  DataTable,
  FilterBar,
  PageHeader,
  resolveStatusRole,
  ViewSwitcher,
  type WorkspaceView,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { useI18n } from "@/i18n/I18nContext";
import { formatTemplate } from "@/lib/format/template";
import { CreateLeadsModal } from "./components/CreateLeadsModal";
import { DeleteLeadsConfirmModal } from "./components/DeleteLeadsConfirmModal";
import { type LeadItem, useLeads } from "./hooks/useLeads";

const ROLE_TONE: Record<string, NonNullable<BadgeProps["tone"]>> = {
  positive: "positive",
  negative: "negative",
  caution: "caution",
  pending: "neutral",
};

export default function LeadsPage() {
  const { t, lang } = useI18n();
  const {
    activeView,
    setActiveView,
    items,
    stages,
    branchIds,
    branchId,
    selectBranch,
    canCreate,
    canUpdateLead,
    canDeleteLead,
    isLoading,
    isDeleting,
    isMovePending,
    error,
    searchQuery,
    setSearchQuery,
    pageInfo,
    setPage,
    isCreateOpen,
    setIsCreateOpen,
    openCreate,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
    moveLead,
    fetchLeads,
  } = useLeads();

  const view: WorkspaceView = activeView === "list" ? "table" : activeView;
  function setView(next: WorkspaceView) {
    setActiveView(next === "table" ? "list" : next);
  }

  const stageById = useMemo(() => new Map(stages.map((stage) => [stage.id, stage])), [stages]);

  function stageName(stageId: string) {
    const stage = stageById.get(stageId);
    if (!stage) return stageId;
    return lang === "ar" ? stage.nameAr : stage.nameEn;
  }

  function renderCard(lead: LeadItem) {
    const stage = stageById.get(lead.stageId);
    const role = stage ? resolveStatusRole("LeadStageFlag", stage.flag) : undefined;
    const sourceName = lang === "ar" ? lead.sourceNameAr : lead.sourceNameEn;
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-medium text-foreground">{lead.leadName}</span>
          {canDeleteLead(lead) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(event) => {
                event.stopPropagation();
                setSelectedForDelete(lead);
              }}
              aria-label={`${t.common.delete}: ${lead.leadName}`}
            >
              <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
            </Button>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{lead.company}</p>
        {lead.email && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground" dir="ltr">
            <Phone className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{lead.phone}</span>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5">
          <Badge tone={role ? ROLE_TONE[role] : "neutral"}>{stageName(lead.stageId)}</Badge>
          {sourceName && (
            <span className="flex items-center gap-1 text-2xs text-muted-foreground">
              <Share2 className="size-3 shrink-0" aria-hidden="true" />
              <span className="max-w-24 truncate">{sourceName}</span>
            </span>
          )}
        </div>
      </div>
    );
  }

  const boardColumns: BoardColumnDef[] = stages.map((stage) => {
    const role = resolveStatusRole("LeadStageFlag", stage.flag);
    return {
      id: stage.id,
      label: lang === "ar" ? stage.nameAr : stage.nameEn,
      count: items.filter((item) => item.stageId === stage.id).length,
      outcomeRole: role === "positive" || role === "negative" || role === "caution" ? role : undefined,
    };
  });

  const cardsByColumn = Object.fromEntries(
    stages.map((stage) => [stage.id, items.filter((item) => item.stageId === stage.id)]),
  );

  const tableColumns: ColumnDef<LeadItem>[] = [
    {
      id: "name",
      header: t.crmLeads.name,
      cell: (item) => (
        <div>
          <p className="font-medium text-foreground">{item.leadName}</p>
          <p className="text-2xs text-muted-foreground">{item.company}</p>
        </div>
      ),
    },
    {
      id: "contact",
      header: t.crmLeads.contact,
      cell: (item) => (
        <div dir="ltr">
          <p>{item.email || t.crmLeads.unavailable}</p>
          {item.phone && <p className="text-2xs text-muted-foreground">{item.phone}</p>}
        </div>
      ),
    },
    {
      id: "stage",
      header: t.crmLeads.stage,
      cell: (item) => {
        const stage = stageById.get(item.stageId);
        const role = stage ? resolveStatusRole("LeadStageFlag", stage.flag) : undefined;
        return <Badge tone={role ? ROLE_TONE[role] : "neutral"}>{stageName(item.stageId)}</Badge>;
      },
    },
    {
      id: "source",
      header: t.crmLeads.source,
      cell: (item) => (lang === "ar" ? item.sourceNameAr : item.sourceNameEn) || t.crmLeads.unavailable,
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end",
      sticky: "end",
      cell: (item) =>
        canDeleteLead(item) ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedForDelete(item)}
            aria-label={`${t.common.delete}: ${item.leadName}`}
          >
            <Trash2 className="size-4 text-destructive" aria-hidden="true" />
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="flex h-full flex-col gap-4">
      <PageHeader
        title={t.crmLeads.title}
        description={t.crmLeads.subtitle}
        primaryAction={canCreate ? { label: t.crmLeads.addLead, onClick: openCreate } : undefined}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterBar
          filters={[]}
          values={{}}
          onChange={() => undefined}
          onReset={() => undefined}
          searchValue={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder={t.crmLeads.search}
        />
        <div className="flex items-center gap-2">
          <TenantBranchSelect
            branchIds={branchIds}
            branchId={branchId}
            onChange={selectBranch}
            disabled={isLoading || isMovePending}
          />
          <ViewSwitcher
            value={view}
            onChange={setView}
            available={["board", "card", "table"]}
            labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
          />
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-negative-200 bg-negative-100 p-2.5 text-xs text-negative-800 dark:border-negative-800 dark:bg-negative-950 dark:text-negative-300"
        >
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void fetchLeads()}>
            {t.common.retry}
          </Button>
        </div>
      )}

      <div className="min-h-0 flex-1">
        {view === "board" && (
          <BoardView
            columns={boardColumns}
            cardsByColumn={cardsByColumn}
            itemKey={(item) => item.id}
            renderCard={renderCard}
            canDrag={(item) =>
              !isMovePending && canUpdateLead(item) && stageById.get(item.stageId)?.flag !== "CONVERTED"
            }
            onCardMove={(move) => {
              if (stageById.get(move.toColumnId)?.flag === "CONVERTED") return;
              void moveLead(move.itemId, move.toColumnId);
            }}
            isLoading={isLoading}
            error={null}
            emptyColumnLabel={t.crmLeads.emptyColumn}
          />
        )}
        {view === "card" && (
          <CardView items={items} renderCard={renderCard} itemKey={(item) => item.id} isLoading={isLoading} error={null} />
        )}
        {view === "table" && (
          <DataTable
            columns={tableColumns}
            rows={items}
            isLoading={isLoading}
            error={null}
            page={pageInfo}
            onPageChange={(page) => setPage(page)}
            rowKey={(item) => item.id}
            labels={{
              retry: t.common.retry,
              errorTitle: "",
              emptyTitle: t.crmLeads.empty,
              selectAll: t.common.actions,
              selectRow: t.common.actions,
              sortAscending: t.common.actions,
              sortDescending: t.common.actions,
              notSorted: t.common.actions,
              pagination: {
                previous: t.common.previousPage,
                next: t.common.nextPage,
                summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
              },
            }}
          />
        )}
      </div>

      <CreateLeadsModal
        key={isCreateOpen ? "open" : "closed"}
        isOpen={isCreateOpen}
        stages={stages}
        onSubmit={handleCreate}
        error={isCreateOpen ? error : null}
        onClose={() => setIsCreateOpen(false)}
      />

      <DeleteLeadsConfirmModal
        isOpen={selectedForDelete !== null}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={() => void handleDelete()}
        isDeleting={isDeleting}
        error={selectedForDelete ? error : null}
      />
    </div>
  );
}
