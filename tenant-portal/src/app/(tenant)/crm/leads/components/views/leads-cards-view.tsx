"use client";

import type { LeadItem, LeadStage } from "../../hooks/useLeads";
import { LeadCard } from "../shared/lead-card";
import { useI18n } from "@/i18n/I18nContext";

interface LeadsCardsViewProps {
  items: LeadItem[];
  stages: LeadStage[];
  canDelete: (lead: LeadItem) => boolean;
  onDelete?: (lead: LeadItem) => void;
}

export function LeadsCardsView({
  items,
  stages,
  canDelete,
  onDelete,
}: LeadsCardsViewProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";

  if (items.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500">
        <p className="text-lg font-medium">
          {isRtl ? "لا توجد عملاء محتملون" : "No leads found"}
        </p>
        <p className="text-sm mt-1">
          {isRtl ? "جرّب تغيير كلمات البحث" : "Try changing the search terms"}
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {items.map((lead) => (
          <LeadCard
            key={lead.id}
            lead={lead}
            stages={stages}
            onDelete={onDelete}
            canDelete={canDelete(lead)}
          />
        ))}
      </div>
    </div>
  );
}
