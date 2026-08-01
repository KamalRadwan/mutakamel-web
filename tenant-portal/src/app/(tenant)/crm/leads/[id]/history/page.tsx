"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "استقبال الطلب من إعلانات جوجل", user: "النظام التلقائي", timestamp: "2026-07-20 10:00:00" },
  { id: 2, action: "ترقية المرحلة إلى تقديم العرض الفني", user: "أحمد محمود", timestamp: "2026-07-22 15:30:00" },
];

export default function LeadHistoryPage() {
  const columns = [
    { header: "النشاط / التغيير", accessorKey: "action" as const },
    { header: "المُنفذ", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل التفاعلات والتأهيل للعميل المحتمل</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
