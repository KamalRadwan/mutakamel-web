"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "اعتماد دليل الذكاء الاصطناعي للتسعير التلقائي", user: "فريق الذكاء الاصطناعي", timestamp: "2026-07-15 10:00:00" },
  { id: 2, action: "ترقية النموذج الموصى به إلى Gemini 1.5 Pro", user: "مدير النظام", timestamp: "2026-07-20 16:00:00" },
];

export default function TradeAiHistoryPage() {
  const columns = [
    { header: "التعديل / الترقية", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل اصدارات وتعديلات دليل الذكاء الاصطناعي</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
