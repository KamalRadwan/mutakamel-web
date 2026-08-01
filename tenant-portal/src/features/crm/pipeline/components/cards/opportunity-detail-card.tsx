"use client";

import { MoreVertical, Star, Calendar, MessageSquare } from "lucide-react";
import type { OpportunityCardRecord } from "../../../models/pipeline-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { OpportunityImportanceStars } from "../shared/opportunity-importance-stars";

interface OpportunityDetailCardProps {
  item: OpportunityCardRecord;
  updateImportance: (cardId: string, importance: number) => void;
}

export function OpportunityDetailCard({ item, updateImportance }: OpportunityDetailCardProps) {
  return (
    <div className="bg-white dark:bg-gray-950 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden hover:shadow-md transition-shadow group flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 dark:border-gray-800/60 relative">
        <div className="absolute top-4 right-4 rtl:left-4 rtl:right-auto">
          <Button variant="ghost" size="icon" className="w-8 h-8 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
        
        <span className={cn(
          "inline-block px-2.5 py-1 rounded text-xs font-semibold mb-2",
          item.stageFlag === "WON" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
          item.stageFlag === "LOST" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400" :
          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
        )}>
          {item.stageFlag === "NEW" ? "جديد" : 
           item.stageFlag === "WON" ? "فوز" : 
           item.stageFlag === "LOST" ? "خسارة" : "مفتوح"}
        </span>

        <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 line-clamp-2 min-h-[3rem]">
          <a href={`/crm/pipeline/${item.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            {item.title}
          </a>
        </h3>
      </div>

      {/* Body Info */}
      <div className="p-4 flex-1 flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-gray-500 dark:text-gray-400 text-xs">العميل</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{item.customerCompanyName}</span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-gray-500 dark:text-gray-400 text-xs">المالك</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">
              {item.ownerDisplayName?.split(" ").map(n => n[0]).join("")}
            </div>
            <span className="text-gray-700 dark:text-gray-300">{item.ownerDisplayName}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400 text-[10px] uppercase">القيمة التجارية</span>
            <span className="font-bold text-gray-900 dark:text-gray-100">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: item.currencyCode, maximumFractionDigits: 0 }).format(item.amount)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400 text-[10px] uppercase">الإغلاق المتوقع</span>
            <span className="font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {item.expectedCloseDate ? new Date(item.expectedCloseDate).toLocaleDateString("en-GB", { month: "short", day: "numeric" }) : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3 bg-gray-50 dark:bg-gray-900/80 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center mt-auto">
        <OpportunityImportanceStars 
          importance={item.importance} 
          starClassName="w-4 h-4"
          onChange={(val) => updateImportance(item.id, val)} 
        />

        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold",
          item.openActivityCount > 0 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "text-gray-500 dark:text-gray-400"
        )}>
          <MessageSquare className="w-3.5 h-3.5" />
          {item.openActivityCount} نشاط
        </div>
      </div>
    </div>
  );
}
