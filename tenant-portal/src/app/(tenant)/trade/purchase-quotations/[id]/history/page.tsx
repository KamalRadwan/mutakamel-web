"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "استلام عرض السعر RFQ-2026-301 بمبلغ 780,000 ر.س", user: "مكتب المشتريات", timestamp: "2026-07-05 10:00:00" },
  { id: 2, action: "تحويل العرض للجنة التقييم الفني والمالي", user: "لجنة المنافسات", timestamp: "2026-07-10 11:30:00" },
];

export default function QuotationHistoryPage() {
  const columns = [
    { header: "الحدث / مرحلة التقييم RFQ Event", accessorKey: "action" as const },
    { header: "المستخدم / اللجنة", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل دراسة وتقييم عرض سعر المورد</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
