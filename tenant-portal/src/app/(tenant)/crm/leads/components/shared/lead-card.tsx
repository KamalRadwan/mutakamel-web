"use client";

import { Building2, Mail, Phone, Share2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { LeadItem, LeadStage } from "../../hooks/useLeads";
import { useI18n } from "@/i18n/I18nContext";

interface LeadCardProps {
  lead: LeadItem;
  stages: LeadStage[];
  onDelete?: (lead: LeadItem) => void;
  canDelete?: boolean;
  className?: string;
}

export function LeadCard({
  lead,
  stages,
  onDelete,
  canDelete = false,
  className = "",
}: LeadCardProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";
  const sourceName = isRtl ? lead.sourceNameAr : lead.sourceNameEn;
  
  const stage = stages.find((candidate) => candidate.id === lead.stageId);
  const stageName = stage ? (isRtl ? stage.nameAr : stage.nameEn) : lead.stageId;

  return (
    <div className={`group bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 shadow-xs hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700/50 transition-all ${className}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {lead.leadName}
          </h4>
          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">{lead.company}</span>
          </div>
        </div>
        
        {onDelete && canDelete ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(lead);
            }}
            className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/50 rounded-lg transition-all"
            title={isRtl ? "حذف" : "Delete"}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        ) : null}
      </div>

      <div className="space-y-1.5 mb-3">
        {lead.email ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <Mail className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
            <span className="truncate">{lead.email}</span>
          </div>
        ) : null}
        {lead.phone ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
            <Phone className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
            <span className="truncate" dir="ltr">{lead.phone}</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
        <Badge variant="neutral" className="text-[10px] py-0.5 px-2 bg-slate-50 dark:bg-slate-800/50">
          {stageName}
        </Badge>
        
        {sourceName ? (
          <div
            className="flex items-center gap-1 text-[10px] text-slate-400"
            title={isRtl ? "المصدر" : "Source"}
          >
            <Share2 className="w-3 h-3" />
            <span className="truncate max-w-[80px]">{sourceName}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
