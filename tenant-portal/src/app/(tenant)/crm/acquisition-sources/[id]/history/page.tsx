"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "ربط القناة بإعلانات جوجل", user: "فريق التسويق", timestamp: "2026-07-01 10:00:00" },
  { id: 2, action: "تحديث معدل التحويل إلى 18.4%", user: "النظام التلقائي", timestamp: "2026-07-24 18:00:00" },
];

export default function SourceHistoryPage() {
  const columns = [
    { header: "الحدث / الحركة", accessorKey: "action" as const },
    { header: "المصدر / المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل أداء مصدر الاستقطاب</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
