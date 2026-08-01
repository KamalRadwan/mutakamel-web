"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "طلب شحن عبر Stripe", status: "مكتمل", timestamp: "2026-07-20 14:00:00" },
  { id: 2, action: "تأكيد إيداع $5,000.00 في رصيد المحفظة", status: "ناجح", timestamp: "2026-07-20 14:02:00" },
];

export default function WalletHistoryPage() {
  const columns = [
    { header: "الحدث / التأكيد البنكي", accessorKey: "action" as const },
    { header: "الحالة", accessorKey: "status" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل الإيداعات والاستقطاعات المالية</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
