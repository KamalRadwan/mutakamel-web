"use client";

import { Search, LayoutGrid, Columns3, List, Filter } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { usePipelineWorkspace } from "../hooks/usePipelineWorkspace";
import { PipelineBoardView } from "./views/pipeline-board-view";
import { PipelineCardsView } from "./views/pipeline-cards-view";
import { PipelineListView } from "./views/pipeline-list-view";
import { TerminalMoveModal } from "./shared/terminal-move-modal";
import { useI18n } from "@/i18n/I18nContext";

export function PipelineWorkspace() {
  const { 
    activeView, setActiveView, board, searchQuery, setSearchQuery, moveCard,
    terminalMove, confirmTerminalMove, cancelTerminalMove, updateImportance
  } = usePipelineWorkspace();
  const { dict } = useI18n();

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-black/95 overflow-hidden">
      <div className="flex-none p-4 md:p-6 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {board.pipeline.nameAr}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            أدر فرص المبيعات وتابع مراحل الإغلاق بسهولة
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في الفرص..."
              className="pr-9"
            />
          </div>

          <Button variant="outline" size="icon" title="فلترة">
            <Filter className="w-4 h-4" />
          </Button>

          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1 border border-gray-200 dark:border-gray-700">
            <Button
              variant={activeView === "board" ? "secondary" : "ghost"}
              size="sm"
              className={`px-3 ${activeView === "board" ? "bg-white dark:bg-gray-700 shadow-sm" : ""}`}
              onClick={() => setActiveView("board")}
              title="لوحة كانبان (Board)"
            >
              <Columns3 className="w-4 h-4" />
            </Button>
            <Button
              variant={activeView === "cards" ? "secondary" : "ghost"}
              size="sm"
              className={`px-3 ${activeView === "cards" ? "bg-white dark:bg-gray-700 shadow-sm" : ""}`}
              onClick={() => setActiveView("cards")}
              title="بطاقات (Cards)"
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
            <Button
              variant={activeView === "list" ? "secondary" : "ghost"}
              size="sm"
              className={`px-3 ${activeView === "list" ? "bg-white dark:bg-gray-700 shadow-sm" : ""}`}
              onClick={() => setActiveView("list")}
              title="قائمة (List)"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden relative">
        {activeView === "board" && <PipelineBoardView board={board} moveCard={moveCard} updateImportance={updateImportance} />}
        {activeView === "cards" && <PipelineCardsView board={board} updateImportance={updateImportance} />}
        {activeView === "list" && <PipelineListView board={board} updateImportance={updateImportance} />}
      </div>

      <TerminalMoveModal
        isOpen={!!terminalMove}
        onClose={cancelTerminalMove}
        opportunity={terminalMove?.opportunity || null}
        targetFlag={terminalMove?.targetFlag || "WON"}
        onConfirm={confirmTerminalMove}
      />
    </div>
  );
}
