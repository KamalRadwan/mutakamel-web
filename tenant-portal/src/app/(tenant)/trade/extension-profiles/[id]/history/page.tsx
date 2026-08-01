"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "تثبيت وتفعيل الملحق ext-acc-auditor الإصدار v2.4.0", user: "مدير النظام", timestamp: "2026-07-01 09:00:00" },
  { id: 2, action: "ربط 6 Hook Points في دورة حياة المبيعات", user: "فريق التطوير", timestamp: "2026-07-10 15:00:00" },
];

export default function ExtensionHistoryPage() {
  const columns = [
    { header: "التثبيت / التحديث التوسعي", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل عمليات تثبيت وترقية الملحق التوسعي</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
