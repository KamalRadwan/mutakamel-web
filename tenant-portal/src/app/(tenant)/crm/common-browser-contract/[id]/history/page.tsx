"use client";

import { Table } from "@/components/ui/Table";
import { useI18n } from "@/i18n/I18nContext";

const historyLogs = [
  { id: 1, action: "I18N_FALLBACK", user: "I18N_FALLBACK", timestamp: "2026-07-01 00:00:00" },
  { id: 2, action: "I18N_FALLBACK", user: "I18N_FALLBACK", timestamp: "2026-07-24 12:00:00" },
];

export default function ContractHistoryPage() {
    const { t } = useI18n();
  const columns = [
    { header: t.crm.eventAccreditation, accessorKey: "action" as const },
    { header: t.crm.responsible, accessorKey: "user" as const },
    { header: t.crm.dateAndTime, accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.recordOfApprovalAndAmendme}</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
