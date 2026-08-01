"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "انتقال الصفقة من (تقديم العرض الفني) إلى (المفاوضات النهائية)", duration: "4 أيام", timestamp: "2026-07-20 11:00:00" },
  { id: 2, action: "إنشاء الفرصة التجارية بقيمة 450,000 ر.س", duration: "يوم واحد", timestamp: "2026-07-16 09:00:00" },
];

export default function OpportunityHistoryPage() {
  const columns = [
    { header: "الانتقال بين المراحل Stage Transition", accessorKey: "action" as const },
    { header: "المدة المستغرقة", accessorKey: "duration" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل الانتقالات الكامل بين مراحل قمع المبيعات</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
