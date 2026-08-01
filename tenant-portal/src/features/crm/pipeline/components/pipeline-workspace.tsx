"use client";

import { useState } from "react";
import { Search, LayoutGrid, Columns3, List, Filter } from "lucide-react";
import { usePipelineWorkspace } from "../hooks/usePipelineWorkspace";
import { PipelineBoardView } from "./views/pipeline-board-view";
import { PipelineCardsView } from "./views/pipeline-cards-view";
import { PipelineListView } from "./views/pipeline-list-view";
import { TerminalMoveModal } from "./shared/terminal-move-modal";
import { CommunicationConfirmModal, CommActionType } from "./shared/communication-confirm-modal";
import { OpportunityActivitiesModal } from "./shared/opportunity-activities-modal";
import type { OpportunityCardRecord } from "../models/pipeline-types";
import { useI18n } from "@/i18n/I18nContext";

import { PipelineSelectDropdown } from "@/components/layout/PipelineSelectDropdown";
import { BranchSelectDropdown } from "@/components/layout/BranchSelectDropdown";
import { PipelineMultiSearch } from "./shared/pipeline-multi-search";

export function PipelineWorkspace() {
  const { t } = useI18n();
  const { 
    activeView, setActiveView, board, searchTokens, setSearchTokens, moveCard,
    terminalMove, confirmTerminalMove, cancelTerminalMove, updateImportance
  } = usePipelineWorkspace();

  // Communication Confirmation Modal State
  const [commState, setCommState] = useState<{
    isOpen: boolean;
    actionType: CommActionType | null;
    item: OpportunityCardRecord | null;
  }>({
    isOpen: false,
    actionType: null,
    item: null,
  });

  // Opportunity Activities Modal State
  const [activitiesState, setActivitiesState] = useState<{
    isOpen: boolean;
    item: OpportunityCardRecord | null;
  }>({
    isOpen: false,
    item: null,
  });

  const handleOpenCommModal = (actionType: CommActionType, item: OpportunityCardRecord) => {
    setCommState({
      isOpen: true,
      actionType,
      item,
    });
  };

  const handleOpenActivitiesModal = (item: OpportunityCardRecord) => {
    setActivitiesState({
      isOpen: true,
      item,
    });
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-black/95 overflow-hidden">
      {/* 45px Second Navbar (Search, Pipeline & Branch Selectors, View Switcher, Filter) */}
      <div className="flex-none h-[45px] px-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between gap-3">
        {/* Selectors & Search Bar */}
        <div className="flex items-center gap-2">
          {/* Branch Select Dropdown */}
          <BranchSelectDropdown />

          {/* Pipeline Select Dropdown */}
          <PipelineSelectDropdown />

          {/* Multi-Input Search */}
          <PipelineMultiSearch tokens={searchTokens} onChange={setSearchTokens} />
        </div>

        {/* View Switcher & Filter */}
        <div className="flex items-center gap-2">
          {/* View Toggle */}
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
              <Columns3 className="w-3.5 h-3.5" />
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
              <LayoutGrid className="w-3.5 h-3.5" />
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
              <List className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Filter button */}
          <button
            type="button"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/50 transition-colors cursor-pointer"
            title={t.common.filter || t.crm.filtering}
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden relative">
        {activeView === "board" && (
          <PipelineBoardView
            board={board}
            moveCard={moveCard}
            updateImportance={updateImportance}
            onOpenActivitiesModal={handleOpenActivitiesModal}
          />
        )}
        {activeView === "card" && (
          <PipelineCardsView
            board={board}
            updateImportance={updateImportance}
            onOpenCommModal={handleOpenCommModal}
            onOpenActivitiesModal={handleOpenActivitiesModal}
          />
        )}
        {activeView === "list" && (
          <PipelineListView
            board={board}
            updateImportance={updateImportance}
            onOpenActivitiesModal={handleOpenActivitiesModal}
          />
        )}
      </div>

      <TerminalMoveModal
        isOpen={!!terminalMove}
        onClose={cancelTerminalMove}
        opportunity={terminalMove?.opportunity || null}
        targetFlag={terminalMove?.targetFlag || "WON"}
        onConfirm={confirmTerminalMove}
      />

      <CommunicationConfirmModal
        isOpen={commState.isOpen}
        onClose={() => setCommState({ isOpen: false, actionType: null, item: null })}
        actionType={commState.actionType}
        customerName={commState.item?.customerCompanyName || ""}
        phoneCode={commState.item?.customerCountry === "SA" ? "+966" : "+966"}
        phoneNumber={commState.item?.customerPhone || "501234567"}
      />

      <OpportunityActivitiesModal
        isOpen={activitiesState.isOpen}
        onClose={() => setActivitiesState({ isOpen: false, item: null })}
        opportunity={activitiesState.item}
      />
    </div>
  );
}
