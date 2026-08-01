"use client";

import Link from "next/link";
import { MoreVertical, Calendar, MessageSquare, Phone, MessageCircle, Send } from "lucide-react";
import type { OpportunityCardRecord } from "../../models/pipeline-types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { OpportunityImportanceStars } from "../shared/opportunity-importance-stars";
import type { CommActionType } from "../shared/communication-confirm-modal";
import { useI18n } from "@/i18n/I18nContext";

interface OpportunityDetailCardProps {
  item: OpportunityCardRecord;
  updateImportance: (cardId: string, importance: number) => void;
  onOpenCommModal?: (action: CommActionType, item: OpportunityCardRecord) => void;
  onOpenActivitiesModal?: (item: OpportunityCardRecord) => void;
}

export function OpportunityDetailCard({
  item,
  updateImportance,
  onOpenCommModal,
  onOpenActivitiesModal,
}: OpportunityDetailCardProps) {
    const { t } = useI18n();
  const phoneCode = item.customerCountry === "SA" ? "+966" : item.customerCountry === "AE" ? "+971" : "+966";
  const rawPhone = item.customerPhone || "501234567";
  const displayPhone = `${phoneCode} ${rawPhone}`;

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
          {item.stageFlag === "NEW" ? t.crm.new : 
           item.stageFlag === "WON" ? t.crm.victory : 
           item.stageFlag === "LOST" ? t.crm.loss : t.crm.open}
        </span>

        <h3 className="font-bold text-base text-gray-900 dark:text-gray-100 line-clamp-2 min-h-[3rem]">
          <Link href={`/crm/pipeline/${item.id}`} className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
            {item.title}
          </Link>
        </h3>
      </div>

      {/* Body Info */}
      <div className="p-4 flex-1 flex flex-col gap-3 text-sm">
        <div className="flex flex-col gap-1">
          <span className="text-gray-500 dark:text-gray-400 text-xs">{t.crm.client}</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{item.customerCompanyName}</span>
        </div>

        {/* Customer Phone Code + Number with 3 Action Icons (WhatsApp, Phone, Telegram) */}
        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-100 dark:border-slate-800">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {t.crm.contactNumber}</span>
            <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
              {displayPhone}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {/* WhatsApp Icon */}
            <button
              type="button"
              onClick={() => onOpenCommModal?.("whatsapp", item)}
              className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/80 transition-colors cursor-pointer"
              title={t.crm.sendAWhatsAppMessage}
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </button>

            {/* Phone Icon */}
            <button
              type="button"
              onClick={() => onOpenCommModal?.("phone", item)}
              className="p-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/80 transition-colors cursor-pointer"
              title={t.crm.makeAPhoneCallPhoneWebRT}
            >
              <Phone className="w-3.5 h-3.5" />
            </button>

            {/* Telegram Icon */}
            <button
              type="button"
              onClick={() => onOpenCommModal?.("telegram", item)}
              className="p-1.5 rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-950/60 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/80 transition-colors cursor-pointer"
              title={t.crm.sendATelegramMessage}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-gray-500 dark:text-gray-400 text-xs">{t.crm.owner}</span>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center text-[10px] font-bold">
              {item.ownerDisplayName?.split(" ").map((n: string) => n[0]).join("")}
            </div>
            <span className="text-gray-700 dark:text-gray-300">{item.ownerDisplayName}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1 bg-gray-50 dark:bg-gray-900/50 p-2 rounded-lg border border-gray-100 dark:border-gray-800">
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400 text-[10px] uppercase">{t.crm.commercialValue}</span>
            <span className="font-bold text-gray-900 dark:text-gray-100">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: item.currencyCode, maximumFractionDigits: 0 }).format(item.amount)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-gray-500 dark:text-gray-400 text-[10px] uppercase">{t.crm.expectedClosure}</span>
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

        <button
          type="button"
          onClick={() => onOpenActivitiesModal?.(item)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold hover:opacity-80 transition-opacity cursor-pointer",
            item.openActivityCount > 0 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" : "text-gray-500 dark:text-gray-400"
          )}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          {item.openActivityCount} {t.crm.activity}</button>
      </div>
    </div>
  );
}
