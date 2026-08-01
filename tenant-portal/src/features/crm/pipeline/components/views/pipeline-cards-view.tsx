import { useState } from "react";
import type { OpportunityBoard, OpportunityCardRecord } from "../../models/pipeline-types";
import { OpportunityDetailCard } from "../cards/opportunity-detail-card";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nContext";
import type { CommActionType } from "../shared/communication-confirm-modal";

interface PipelineCardsViewProps {
  board: OpportunityBoard;
  updateImportance: (cardId: string, importance: number) => void;
  onOpenCommModal?: (action: CommActionType, item: OpportunityCardRecord) => void;
  onOpenActivitiesModal?: (item: OpportunityCardRecord) => void;
}

export function PipelineCardsView({
  board,
  updateImportance,
  onOpenCommModal,
  onOpenActivitiesModal,
}: PipelineCardsViewProps) {
  const [activeStageId, setActiveStageId] = useState<string>("all");
  const { t } = useI18n();

  const allLabel = t.common.filter === "Filter" ? "All" : t.crm.everyone;
  const stages = [{ id: "all", name: allLabel }, ...board.stages.map(l => ({ id: l.stage.id, name: l.stage.nameAr }))];
  
  const allItems = board.stages.flatMap(l => l.items);
  const displayedItems = activeStageId === "all" 
    ? allItems 
    : board.stages.find(l => l.stage.id === activeStageId)?.items || [];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#040810]">
      {/* Stage Filters Bar */}
      <div className="flex-none px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 min-w-max">
          {stages.map(stage => (
            <button
              key={stage.id}
              onClick={() => setActiveStageId(stage.id)}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer",
                activeStageId === stage.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              {stage.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {displayedItems.map(item => (
            <OpportunityDetailCard
              key={item.id}
              item={item}
              updateImportance={updateImportance}
              onOpenCommModal={onOpenCommModal}
              onOpenActivitiesModal={onOpenActivitiesModal}
            />
          ))}
          {displayedItems.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500">
              {t.crm.thereAreNoOpportunitiesAt}</div>
          )}
        </div>
      </div>
    </div>
  );
}
