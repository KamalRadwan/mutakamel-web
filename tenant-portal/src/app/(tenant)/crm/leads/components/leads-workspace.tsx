"use client";

import { Search, LayoutGrid, Columns3, List, Filter, UserPlus } from "lucide-react";
import { useLeads } from "../hooks/useLeads";
import { PageHeader } from "@/components/ui/PageHeader";

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
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
    moveLead,
  } = useLeads();

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-slate-50 dark:bg-black/95 overflow-hidden">
      <div className="px-4 py-4 sm:px-6 lg:px-8 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
        <PageHeader
          title={isRtl ? t.crm.leadsManagement : "Leads Management"}
          subtitle={isRtl ? t.crm.followUpOnRequestsForAtte : "Track interests and assign sales representatives"}
          actionLabel={isRtl ? t.crm.addAPotentialClient : "Add Lead"}
          onAction={() => setIsCreateOpen(true)}
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
            placeholder={isRtl ? t.crm.searchByPotentialClientNam : "Search leads..."}
            className="w-full h-8 ps-9 pe-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="flex items-center gap-2">
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

          <button
            type="button"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors cursor-pointer"
            title={isRtl ? t.crm.filtering : "Filter"}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden relative">
        {activeView === "board" && (
          <LeadsBoardView
            items={items}
            moveLead={moveLead}
            onDelete={(lead) => setSelectedForDelete(lead)}
          />
        )}
        {activeView === "card" && (
          <LeadsCardsView
            items={items}
            onDelete={(lead) => setSelectedForDelete(lead)}
          />
        )}
        {activeView === "list" && (
          <LeadsListView
            items={items}
            onDelete={(lead) => setSelectedForDelete(lead)}
          />
        )}
      </div>

      <CreateLeadsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteLeadsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}