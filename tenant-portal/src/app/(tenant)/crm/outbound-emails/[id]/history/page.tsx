"use client";

import { Table } from "@/components/ui/Table";
import { useI18n } from "@/i18n/I18nContext";

const historyLogs = [
  { id: 1, action: "I18N_FALLBACK", status: "I18N_FALLBACK", timestamp: "2026-07-25 09:30:00" },
  { id: 2, action: "I18N_FALLBACK", status: "Opened (Safari iOS)", timestamp: "2026-07-25 09:32:00" },
];

export default function OutboundEmailHistoryPage() {
    const { t } = useI18n();
  const columns = [
    { header: t.crm.eventMovement, accessorKey: "action" as const },
    { header: t.crm.technicalCondition, accessorKey: "status" as const },
    { header: t.crm.dateAndTime, accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.recordTheOpeningAndDeliver}</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
