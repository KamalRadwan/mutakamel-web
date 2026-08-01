"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إنشاء شاشة متابعة المبيعات b2b_trade_live", user: "مدير التجارة", timestamp: "2026-07-01 10:00:00" },
  { id: 2, action: "إضافة ودجت سرعة تدوير المخزون وويدجت DSO", user: "أحمد محمود", timestamp: "2026-07-15 11:30:00" },
];

export default function TradeDashboardHistoryPage() {
  const columns = [
    { header: "التعديل / التوزيع", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل إعدادات وتخصيص اللوحة التجارية</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
