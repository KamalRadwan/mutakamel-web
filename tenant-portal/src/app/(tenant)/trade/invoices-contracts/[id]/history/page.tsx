"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إصدار الفاتورة الضريبية INV-2026-9011 بمبلغ 138,000 ر.س", user: "حسابات المبيعات", timestamp: "2026-07-20 10:00:00" },
  { id: 2, action: "اعتماد التقرير الآلي لدى هيئة الزكاة Phase 2 Reporting", user: "محرك الربط ZATCA", timestamp: "2026-07-20 10:01:00" },
];

export default function InvoiceHistoryPage() {
  const columns = [
    { header: "الحدث / الاعتماد ZATCA Event", accessorKey: "action" as const },
    { header: "المستخدم / المحرك", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل التحصيل والاعتماد لدى هيئة الزكاة والضريبة</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
