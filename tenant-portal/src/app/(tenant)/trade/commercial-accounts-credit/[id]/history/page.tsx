"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "رفع السقف الائتماني من 300,000 إلى 500,000 ر.س", user: "المدير المالي", timestamp: "2026-07-01 10:00:00" },
  { id: 2, action: "سداد دفعة بقيمة 80,000 ر.س وخفض الرصيد", user: "حسابات العملاء", timestamp: "2026-07-18 12:00:00" },
];

export default function AccountHistoryPage() {
  const columns = [
    { header: "الحركة الائتمانية Credit Movement", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل عمليات السداد والتقييم الائتماني</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
