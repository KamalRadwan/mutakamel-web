"use client";

import { Table } from "@/components/ui/Table";
import { useI18n } from "@/i18n/I18nContext";

const historyLogs = [
  { id: 1, action: "إنشاء العميل المحتمل", user: "أحمد المبيعات", timestamp: "2026-07-20 10:00:00" },
  { id: 2, action: "تحديث المرحلة إلى عرض سعر", user: "أحمد المبيعات", timestamp: "2026-07-22 15:30:00" },
];

export default function LeadHistoryPage() {
    const { t } = useI18n();
  const columns = [
    { header: t.crm.activityChange, accessorKey: "action" as const },
    { header: t.crm.port, accessorKey: "user" as const },
    { header: t.crm.dateAndTime, accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.recordLeadInteractionsAndQ}</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
