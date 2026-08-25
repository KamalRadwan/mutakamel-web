"use client";

import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Trash2, UserPlus } from "lucide-react";
import type { LeadItem, LeadStage } from "../../hooks/useLeads";
import { useI18n } from "@/i18n/I18nContext";

interface LeadsListViewProps {
  items: LeadItem[];
  stages: LeadStage[];
  canDelete: (lead: LeadItem) => boolean;
  onDelete?: (lead: LeadItem) => void;
}

export function LeadsListView({
  items,
  stages,
  canDelete,
  onDelete,
}: LeadsListViewProps) {
  const { lang } = useI18n();
  const isRtl = lang === "ar";

  const columns = [
    {
      header: isRtl ? "العميل والشركة" : "Lead & Company",
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
      header: isRtl ? "المرحلة" : "Stage",
      cell: (item: LeadItem) => {
        const stage = stages.find((candidate) => candidate.id === item.stageId);
        const stageName = stage ? (isRtl ? stage.nameAr : stage.nameEn) : item.stageId;
        return <Badge variant="info">{stageName}</Badge>;
      },
    },
    {
      header: isRtl ? "المصدر" : "Source",
      cell: (item: LeadItem) =>
        isRtl ? item.sourceNameAr : item.sourceNameEn,
    },
    {
      header: isRtl ? "الإجراءات" : "Actions",
      cell: (item: LeadItem) => (
        <div className="flex items-center gap-1.5">
          {onDelete && canDelete(item) ? (
            <Button variant="ghost" size="sm" onClick={() => onDelete(item)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          ) : null}
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
