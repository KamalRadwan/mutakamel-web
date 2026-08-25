"use client";

import {
  AlertCircle,
  Columns3,
  LayoutGrid,
  List,
  Loader2,
  Search,
} from "lucide-react";
import { useLeads } from "../hooks/useLeads";
import { PageHeader } from "@/components/ui/PageHeader";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";

// View imports
import { LeadsBoardView } from "./views/leads-board-view";
import { LeadsCardsView } from "./views/leads-cards-view";
import { LeadsListView } from "./views/leads-list-view";

// Modals
import { CreateLeadsModal } from "./CreateLeadsModal";
import { DeleteLeadsConfirmModal } from "./DeleteLeadsConfirmModal";
import { useI18n } from "@/i18n/I18nContext";

export function LeadsWorkspace() {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  
  const {
    t,
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-black/95 overflow-hidden">
      <div className="px-4 py-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <PageHeader
          title={isRtl ? t.crm.leadsManagement : "Leads Management"}
          subtitle={isRtl ? t.crm.followUpOnRequestsForAtte : "Track interests and assign sales representatives"}
          actionLabel={
            canCreate
              ? isRtl
                ? t.crm.addAPotentialClient
                : "Add Lead"
              : undefined
          }
          onAction={canCreate ? openCreate : undefined}
        />
      </div>

      <div className="flex-none h-[50px] px-4 border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 shadow-sm flex items-center justify-between gap-3">
        <div className="relative w-64 md:w-80">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            autoComplete="off"
            suppressHydrationWarning
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            disabled={isMovePending}
            placeholder={isRtl ? t.crm.searchByPotentialClientNam : "Search leads..."}
            className="w-full h-8 ps-9 pe-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2">
          <TenantBranchSelect
            branchIds={branchIds}
            branchId={branchId}
            onChange={selectBranch}
            disabled={isLoading || isDeleting || isMovePending}
          />
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 rounded-lg p-0.5 border border-slate-200 dark:border-slate-700/60 gap-0.5">
            <button
              type="button"
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                activeView === "board"
                  ? "bg-purple-600 text-white shadow-xs font-bold"
                  : "text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50"
              }`}
              onClick={() => setActiveView("board")}
              title={t.crm.kanbanBoard}
            >
              <Columns3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                activeView === "card"
                  ? "bg-emerald-600 text-white shadow-xs font-bold"
                  : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
              }`}
              onClick={() => setActiveView("card")}
              title={t.crm.cards}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              className={`p-1.5 rounded-md transition-all cursor-pointer ${
                activeView === "list"
                  ? "bg-amber-600 text-white shadow-xs font-bold"
                  : "text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50"
              }`}
              onClick={() => setActiveView("list")}
              title={t.crm.list}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden relative">
        {error && (
          <div
            role="alert"
            className="m-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
          >
            <span className="flex min-w-0 items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span className="truncate">{error}</span>
            </span>
            <button
              type="button"
              onClick={() => void fetchLeads()}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              {isRtl ? "إعادة المحاولة" : "Retry"}
            </button>
          </div>
        )}
        {isLoading && items.length === 0 ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="size-4 animate-spin" />
            <span>{isRtl ? "جارٍ تحميل العملاء المحتملين" : "Loading leads"}</span>
          </div>
        ) : activeView === "board" ? (
          <LeadsBoardView
            items={items}
            stages={stages}
            moveLead={moveLead}
            canUpdate={canUpdateLead}
            isMovePending={isMovePending}
            canDelete={canDeleteLead}
            onDelete={(lead) => setSelectedForDelete(lead)}
          />
        ) : activeView === "card" ? (
          <LeadsCardsView
            items={items}
            stages={stages}
            canDelete={canDeleteLead}
            onDelete={(lead) => setSelectedForDelete(lead)}
          />
        ) : (
          <LeadsListView
            items={items}
            stages={stages}
            canDelete={canDeleteLead}
            onDelete={(lead) => setSelectedForDelete(lead)}
          />
        )}
      </div>

      {pageInfo.total > 0 ? (
        <div className="flex flex-none items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          <span>
            {isRtl
              ? `${pageInfo.total} عميل محتمل`
              : `${pageInfo.total} leads`}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(pageInfo.page - 1)}
              disabled={!pageInfo.hasPrev || isLoading || isMovePending}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
            >
              {isRtl ? "السابق" : "Previous"}
            </button>
            <span aria-live="polite">
              {pageInfo.page} / {pageInfo.totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(pageInfo.page + 1)}
              disabled={!pageInfo.hasNext || isLoading || isMovePending}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-semibold disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700"
            >
              {isRtl ? "التالي" : "Next"}
            </button>
          </div>
        </div>
      ) : null}

      <CreateLeadsModal
        key={isCreateOpen ? "open" : "closed"}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        stages={stages}
        onSubmit={handleCreate}
        error={isCreateOpen ? error : null}
      />

      <DeleteLeadsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
        error={selectedForDelete ? error : null}
      />
    </div>
  );
}
