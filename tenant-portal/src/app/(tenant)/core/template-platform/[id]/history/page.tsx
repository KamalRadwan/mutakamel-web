"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إنشاء مسودة القالب v1.0.0", user: "منى علي", timestamp: "2026-07-20 10:00:00" },
  { id: 2, action: "ترقية ونشر القالب إلى v1.4.0", user: "مدير النظام", timestamp: "2026-07-22 14:15:00" },
];

export default function TemplateHistoryPage() {
  const columns = [
    { header: "إصدار وتعديل القالب", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل إصدارهای وتحديثات القالب</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
