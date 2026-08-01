"use client";

import { Table } from "@/components/ui/Table";
import { useI18n } from "@/i18n/I18nContext";

const historyLogs = [
  { id: 1, action: "إضافة العميل للنظام", user: "أحمد المبيعات", timestamp: "2026-07-10 14:00:00" },
  { id: 2, action: "إغلاق صفقة ناجحة", user: "منير سعد", timestamp: "2026-07-22 16:30:00" },
];

export default function CustomerHistoryPage() {
    const { t } = useI18n();
  const columns = [
    { header: t.crm.activityDeal, accessorKey: "action" as const },
    { header: t.crm.accountManager, accessorKey: "user" as const },
    { header: t.crm.dateAndTime, accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{t.crm.transactionHistoryAndClosed}</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
