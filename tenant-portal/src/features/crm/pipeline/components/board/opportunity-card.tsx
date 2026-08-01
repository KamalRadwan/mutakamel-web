import Link from "next/link";
import { Draggable } from "@hello-pangea/dnd";
import { GripVertical, MoreVertical, Star, Clock, AlertCircle } from "lucide-react";
import type { OpportunityCardRecord } from "../../models/pipeline-types";
import { cn } from "@/lib/utils";
import { OpportunityImportanceStars } from "../shared/opportunity-importance-stars";
import { useI18n } from "@/i18n/I18nContext";

interface OpportunityCardProps {
  item: OpportunityCardRecord;
  index: number;
  updateImportance: (cardId: string, importance: number) => void;
  onOpenActivitiesModal?: (item: OpportunityCardRecord) => void;
}

export function OpportunityCard({ item, index, updateImportance, onOpenActivitiesModal }: OpportunityCardProps) {
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
    <Draggable draggableId={item.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={cn(
            "bg-white dark:bg-gray-950 p-3 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col gap-2 relative group cursor-grab active:cursor-grabbing",
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
                <Link href={`/crm/pipeline/${item.id}`} className="font-semibold text-sm text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2">
                  {item.title}
                </Link>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-1">
                  {item.customerCompanyName}
                </div>
              </div>
            </div>
            <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>

          {/* Details */}
          <div className="flex items-center justify-between mt-2">
            <div className="font-bold text-sm text-gray-700 dark:text-gray-200">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: item.currencyCode, maximumFractionDigits: 0 }).format(item.amount)}
            </div>
            
            {/* Importance Stars */}
            <OpportunityImportanceStars 
              importance={item.importance} 
              onChange={(val) => updateImportance(item.id, val)} 
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-1 pt-2 border-t border-gray-100 dark:border-gray-800/60">
            <button
              type="button"
              onClick={() => onOpenActivitiesModal?.(item)}
              className={cn("px-2 py-0.5 rounded text-[10px] font-bold flex items-center hover:opacity-80 transition-opacity cursor-pointer", getActivityColor(item.activityState))}
            >
              {getActivityIcon(item.activityState)}
              {item.activityState === "NO_OPEN" ? t.crm.thereIsNoActivity :
               item.activityState === "OVERDUE" ? t.crm.late :
               item.activityState === "TODAY" ? t.crm.today : t.crm.myFuture}
            </button>
            
            <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-bold border border-blue-200 dark:border-blue-800" title={item.ownerDisplayName}>
              {item.ownerDisplayName?.split(" ").map((n: string) => n[0]).join("")}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
}
