import { Draggable } from "@hello-pangea/dnd";
import { GripVertical, Clock, AlertCircle } from "lucide-react";
import {
  formatCurrencyAmount,
  type OpportunityCardRecord,
} from "../../models/pipeline-types";
import { cn } from "@/lib/utils";
import { OpportunityImportanceStars } from "../shared/opportunity-importance-stars";
import { useI18n } from "@/i18n/I18nContext";

interface OpportunityCardProps {
  item: OpportunityCardRecord;
  index: number;
  updateImportance: (cardId: string, importance: number) => void;
  canUpdate: boolean;
}

export function OpportunityCard({
  item,
  index,
  updateImportance,
  canUpdate,
}: OpportunityCardProps) {
    const { t } = useI18n();
  const getActivityColor = (state: string) => {
    switch (state) {
      case "OVERDUE": return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
      case "TODAY": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
      case "FUTURE": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      default: return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getActivityIcon = (state: string) => {
    if (state === "OVERDUE") return <AlertCircle className="w-3 h-3 ml-1" />;
    return <Clock className="w-3 h-3 ml-1" />;
  };

  return (
    <Draggable draggableId={item.id} index={index} isDragDisabled={!canUpdate}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "bg-white dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col gap-2 relative group",
            canUpdate
              ? "cursor-grab active:cursor-grabbing"
              : "cursor-default",
            snapshot.isDragging ? "shadow-md ring-2 ring-blue-500/50 scale-105 z-50 opacity-90" : "hover:border-blue-300 dark:hover:border-blue-700/50"
          )}
        >
          {/* Top Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-1 flex-1">
              <div
                className="mt-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 opacity-60 group-hover:opacity-100 transition-opacity"
              >
                <GripVertical className="w-4 h-4" />
              </div>
              <div className="flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {item.title}
                </p>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                  {item.customerDisplayName}
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="flex items-center justify-between mt-2">
            <div className="font-bold text-sm text-gray-700 dark:text-gray-200">
              {formatCurrencyAmount(item.amount, item.currencyCode)}
            </div>
            
            {/* Importance Stars */}
            <OpportunityImportanceStars 
              importance={item.importance} 
              onChange={
                canUpdate
                  ? (value) => updateImportance(item.id, value)
                  : undefined
              }
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-100 dark:border-gray-800/60">
            <span
              title={item.nextOpenActivityAt ?? undefined}
              className={cn(
                "flex items-center rounded px-2 py-0.5 text-[10px] font-bold",
                getActivityColor(item.activityState),
              )}
            >
              {getActivityIcon(item.activityState)}
              {item.activityState === "NO_OPEN" ? t.crm.thereIsNoActivity :
               item.activityState === "OVERDUE" ? t.crm.late :
               item.activityState === "TODAY" ? t.crm.today : t.crm.myFuture}
            </span>
            
          </div>
        </div>
      )}
    </Draggable>
  );
}
