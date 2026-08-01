"use client";

import { Eye, MessageSquare, Star } from "lucide-react";
import type { OpportunityBoard } from "../../models/pipeline-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { OpportunityImportanceStars } from "../shared/opportunity-importance-stars";

interface PipelineListViewProps {
  board: OpportunityBoard;
  updateImportance: (cardId: string, importance: number) => void;
}

export function PipelineListView({ board, updateImportance }: PipelineListViewProps) {
  const items = board.stages.flatMap(l => l.items);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#040810]">
      <div className="flex-1 overflow-auto custom-scrollbar">
        <table className="w-full text-sm text-left rtl:text-right text-gray-500 dark:text-gray-400 min-w-[1200px]">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 dark:bg-gray-900 dark:text-gray-400 sticky top-0 z-10 shadow-sm">
            <tr>
              <th scope="col" className="px-4 py-3">الفرصة / العميل</th>
              <th scope="col" className="px-4 py-3">المرحلة</th>
              <th scope="col" className="px-4 py-3">القيمة التجارية</th>
              <th scope="col" className="px-4 py-3 w-48">الاحتمالية</th>
              <th scope="col" className="px-4 py-3">المالك</th>
              <th scope="col" className="px-4 py-3">تاريخ الإغلاق</th>
              <th scope="col" className="px-4 py-3 text-center">الأهمية</th>
              <th scope="col" className="px-4 py-3 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="bg-white border-b dark:bg-[#090d16] dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap dark:text-white">
                  <div className="flex flex-col">
                    <a href={`/crm/pipeline/${item.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm">
                      {item.title}
                    </a>
                    <span className="text-xs text-gray-500 mt-0.5">{item.customerCompanyName}</span>
                  </div>
                </td>
                
                <td className="px-4 py-3">
                  <span className={cn(
                    "inline-block px-2.5 py-1 rounded-full text-xs font-semibold",
                    item.stageFlag === "WON" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" :
                    item.stageFlag === "LOST" ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400" :
                    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                  )}>
                    {board.stages.find(s => s.stage.id === item.stageId)?.stage.nameAr || item.stageId}
                  </span>
                </td>
                
                <td className="px-4 py-3 font-bold text-gray-800 dark:text-gray-200">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: item.currencyCode, maximumFractionDigits: 0 }).format(item.amount)}
                </td>
                
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium w-8 text-right">{item.probabilityPercent}%</span>
                    <div className="w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700 overflow-hidden">
                      <div 
                        className={cn("h-1.5 rounded-full", item.probabilityPercent >= 80 ? "bg-emerald-500" : item.probabilityPercent >= 40 ? "bg-blue-500" : "bg-orange-500")}
                        style={{ width: `${item.probabilityPercent}%` }}
                      />
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-xs font-bold" title={item.ownerDisplayName}>
                      {item.ownerDisplayName?.split(" ").map(n => n[0]).join("")}
                    </div>
                  </div>
                </td>

                <td className="px-4 py-3 text-xs">
                  {item.expectedCloseDate ? new Date(item.expectedCloseDate).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" }) : "-"}
                </td>

                <td className="px-4 py-3">
                  <div className="flex justify-center">
                    <OpportunityImportanceStars 
                      importance={item.importance} 
                      starClassName="w-4 h-4"
                      onChange={(val) => updateImportance(item.id, val)} 
                    />
                  </div>
                </td>

                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 relative">
                      <MessageSquare className="w-4 h-4" />
                      {item.openActivityCount > 0 && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
                      )}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {items.length === 0 && (
          <div className="w-full py-20 flex flex-col items-center justify-center text-gray-500">
            لا توجد فرص لعرضها في القائمة
          </div>
        )}
      </div>
      
      {/* Footer Pagination */}
      <div className="flex-none p-4 border-t border-gray-200 dark:border-gray-800 flex justify-between items-center text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/50">
        <div>
          عرض {items.length} من أصل {items.length} فرصة
        </div>
      </div>
    </div>
  );
}
