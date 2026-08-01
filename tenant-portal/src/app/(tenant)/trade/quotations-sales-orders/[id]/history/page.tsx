"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إصدار وتعميد أمر البيع SO-2026-8801 بمبلغ 138,000 ر.س", user: "مندوب المبيعات", timestamp: "2026-07-20 10:00:00" },
  { id: 2, action: "حجز الأصناف وتحديد موعد التسليم 2026-08-01", user: "محرك التوزيع", timestamp: "2026-07-20 10:02:00" },
];

export default function OrderHistoryPage() {
  const columns = [
    { header: "حركة المستند Sales Event", accessorKey: "action" as const },
    { header: "المستخدم / النظام", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل تعميدات وتجهيز شحنات أمر البيع</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
