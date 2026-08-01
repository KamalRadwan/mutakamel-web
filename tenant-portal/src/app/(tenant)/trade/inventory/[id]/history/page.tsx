"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إضافة شحنة ورودة +200 قطعة من المورد", user: "أحمد محمود", timestamp: "2026-07-20 10:00:00" },
  { id: 2, action: "حجز 20 قطعة لأمر البيع SO-8801", user: "محرك المبيعات", timestamp: "2026-07-22 14:00:00" },
];

export default function InventoryHistoryPage() {
  const columns = [
    { header: "حركة المخزون Stock Movement", accessorKey: "action" as const },
    { header: "المستخدم / النظام", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل حركة الوارد والمصروف وحجوزات المخزون</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
