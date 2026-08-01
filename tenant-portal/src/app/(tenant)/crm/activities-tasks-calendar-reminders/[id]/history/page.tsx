"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "جدولة العرض التقديمي في التقويم", user: "أحمد محمود", timestamp: "2026-07-22 09:00:00" },
  { id: 2, action: "إرسال التذكير الآلي للعميل", user: "محرك التنبيهات", timestamp: "2026-07-25 10:00:00" },
];

export default function CrmTaskHistoryPage() {
  const columns = [
    { header: "الحدث / المهمة", accessorKey: "action" as const },
    { header: "المُنفذ", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل الأحداث والتذكيرات الصادرة للمهمة</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
