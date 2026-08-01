"use client";

import { Droppable } from "@hello-pangea/dnd";
import { ChevronRight, ChevronLeft, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import type { OpportunityBoardLane } from "../../../models/pipeline-types";
import { OpportunityCard } from "./opportunity-card";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface BoardColumnProps {
  lane: OpportunityBoardLane;
  updateImportance: (cardId: string, importance: number) => void;
}

export function BoardColumn({ lane, updateImportance }: BoardColumnProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { stage, items, summary, activitySummary } = lane;

  const getStageColor = (theme?: string) => {
    switch (theme) {
      case "blue": return "bg-blue-500";
      case "indigo": return "bg-indigo-500";
      case "purple": return "bg-purple-500";
      case "orange": return "bg-orange-500";
      case "green": return "bg-emerald-500";
      case "red": return "bg-rose-500";
      default: return "bg-gray-500";
    }
  };

  const getStageBorder = (theme?: string) => {
    switch (theme) {
      case "blue": return "border-blue-200 dark:border-blue-900/50";
      case "indigo": return "border-indigo-200 dark:border-indigo-900/50";
      case "purple": return "border-purple-200 dark:border-purple-900/50";
      case "orange": return "border-orange-200 dark:border-orange-900/50";
      case "green": return "border-emerald-200 dark:border-emerald-900/50";
      case "red": return "border-rose-200 dark:border-rose-900/50";
      default: return "border-gray-200 dark:border-gray-800";
    }
  };

  if (isCollapsed) {
    return (
      <div className={cn("flex-shrink-0 w-12 h-full flex flex-col items-center bg-gray-50 dark:bg-gray-900/50 rounded-xl border", getStageBorder(stage.colorTheme))}>
        <div className="p-2 w-full flex justify-center border-b border-gray-100 dark:border-gray-800">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-full" onClick={() => setIsCollapsed(false)}>
            <ChevronLeft className="w-4 h-4 text-gray-500" />
          </Button>
        </div>
        <div className="flex-1 w-full flex flex-col items-center py-6 gap-4">
          <div className={cn("w-3 h-3 rounded-full", getStageColor(stage.colorTheme))} />
          <div className="writing-vertical-rl text-sm font-semibold text-gray-700 dark:text-gray-300 transform rotate-180">
            {stage.nameAr}
          </div>
          <div className="mt-4 px-2 py-1 bg-gray-200 dark:bg-gray-800 rounded-full text-xs font-bold text-gray-700 dark:text-gray-300">
            {summary.totalCount}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex-shrink-0 w-80 h-full flex flex-col bg-gray-50/80 dark:bg-gray-900/40 rounded-xl border", getStageBorder(stage.colorTheme))}>
      {/* Column Header */}
      <div className="flex flex-col p-3 border-b border-gray-200/60 dark:border-gray-800/60 bg-white/50 dark:bg-gray-900/50 rounded-t-xl">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={cn("w-2.5 h-2.5 rounded-full", getStageColor(stage.colorTheme))} />
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{stage.nameAr}</h3>
            <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400">
              {summary.totalCount}
            </span>
          </div>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200" onClick={() => setIsCollapsed(true)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        
        {/* Activity Status Bar */}
        <div className="w-full flex h-1.5 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800 gap-0.5 mt-1">
          {activitySummary.overdueCount > 0 && <div className="bg-rose-500 h-full" style={{ width: `${(activitySummary.overdueCount / summary.totalCount) * 100}%` }} title="متأخر" />}
          {activitySummary.todayCount > 0 && <div className="bg-orange-500 h-full" style={{ width: `${(activitySummary.todayCount / summary.totalCount) * 100}%` }} title="اليوم" />}
          {activitySummary.futureCount > 0 && <div className="bg-emerald-500 h-full" style={{ width: `${(activitySummary.futureCount / summary.totalCount) * 100}%` }} title="مستقبلي" />}
          {activitySummary.noOpenCount > 0 && <div className="bg-gray-300 dark:bg-gray-700 h-full" style={{ width: `${(activitySummary.noOpenCount / summary.totalCount) * 100}%` }} title="لا يوجد نشاط" />}
        </div>
        
        <div className="text-xs text-gray-500 mt-2 font-medium">
          {new Intl.NumberFormat("en-US", { style: "currency", currency: "SAR", maximumFractionDigits: 0 }).format(summary.amountsByCurrency["SAR"] || 0)}
        </div>
      </div>

      {/* Column Body (Droppable Area) */}
      <Droppable droppableId={stage.id}>
        {(provided, snapshot) => (
          <div
            {...provided.droppableProps}
            ref={provided.innerRef}
            className={cn(
              "flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-2 transition-colors",
              snapshot.isDraggingOver ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
            )}
          >
            {stage.category !== "CLOSED" && (
              <Button variant="ghost" className="w-full justify-start text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-sm mb-1">
                <Plus className="w-4 h-4 mr-2" />
                إضافة فرصة
              </Button>
            )}

            {items.map((item, index) => (
              <OpportunityCard key={item.id} item={item} index={index} updateImportance={updateImportance} />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}
