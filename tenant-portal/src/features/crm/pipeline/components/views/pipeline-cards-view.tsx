"use client";

import { useState } from "react";
import type { OpportunityBoard, OpportunityCardRecord } from "../../models/pipeline-types";
import { OpportunityDetailCard } from "../cards/opportunity-detail-card";
import { cn } from "@/lib/utils";

interface PipelineCardsViewProps {
  board: OpportunityBoard;
  updateImportance: (cardId: string, importance: number) => void;
}

export function PipelineCardsView({ board, updateImportance }: PipelineCardsViewProps) {
  const [activeStageId, setActiveStageId] = useState<string>("all");

  const stages = [{ id: "all", name: "الكل (All)" }, ...board.stages.map(l => ({ id: l.stage.id, name: l.stage.nameAr }))];
  
  const allItems = board.stages.flatMap(l => l.items);
  const displayedItems = activeStageId === "all" 
    ? allItems 
    : board.stages.find(l => l.stage.id === activeStageId)?.items || [];

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#040810]">
      {/* Stage Filters */}
      <div className="flex-none px-4 md:px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 overflow-x-auto custom-scrollbar">
        <div className="flex gap-2 min-w-max">
          {stages.map(stage => (
            <button
              key={stage.id}
              onClick={() => setActiveStageId(stage.id)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-medium transition-colors",
                activeStageId === stage.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
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
            <OpportunityDetailCard key={item.id} item={item} updateImportance={updateImportance} />
          ))}
          {displayedItems.length === 0 && (
            <div className="col-span-full py-12 flex flex-col items-center justify-center text-gray-500">
              لا توجد فرص في هذه المرحلة
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
