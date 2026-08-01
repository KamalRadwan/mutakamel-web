"use client";

import Link from "next/link";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, UserPlus, Flame } from "lucide-react";
import type { LeadItem } from "../../hooks/useLeads";
import { LEAD_STAGES } from "../../hooks/useLeads";
import { useI18n } from "@/i18n/I18nContext";

interface LeadsListViewProps {
  items: LeadItem[];
  onDelete?: (lead: LeadItem) => void;
}

export function LeadsListView({ items, onDelete }: LeadsListViewProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";

  const columns = [
    {
      header: isRtl ? "I18N_FALLBACK" : "Lead & Company",
      cell: (item: LeadItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.leadName}</p>
            <p className="text-[11px] text-slate-400">{item.company} · {item.phone}</p>
          </div>
        </div>
      ),
    },
    {
      header: isRtl ? "I18N_FALLBACK" : "Stage",
      cell: (item: LeadItem) => {
        const stage = LEAD_STAGES.find((s) => s.id === item.stageId);
        const stageName = stage ? (isRtl ? stage.nameAr : stage.nameEn) : item.stageId;
        return <Badge variant="info">{stageName}</Badge>;
      },
    },
    {
      header: isRtl ? "I18N_FALLBACK" : "Score",
      cell: (item: LeadItem) => (
        <div className="flex items-center gap-1 font-bold text-xs text-amber-600">
          <Flame className="w-3.5 h-3.5" />
          <span>{item.score}/100</span>
        </div>
      ),
    },
    { header: isRtl ? "I18N_FALLBACK" : "Source", accessorKey: "source" as keyof LeadItem },
    { header: isRtl ? "I18N_FALLBACK" : "Assigned To", accessorKey: "assignedTo" as keyof LeadItem },
    {
      header: isRtl ? "I18N_FALLBACK" : "Actions",
      cell: (item: LeadItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/leads/${item.id}/general`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          {onDelete && (
            <Button variant="ghost" size="sm" onClick={() => onDelete(item)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-6 bg-slate-50 dark:bg-slate-900/50">
      <Table columns={columns} data={items} />
    </div>
  );
}