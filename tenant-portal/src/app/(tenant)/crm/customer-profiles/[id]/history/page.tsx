"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إغلاق صفقة بقيمة 450,000 ر.س", user: "أحمد محمود", timestamp: "2026-07-10 14:00:00" },
  { id: 2, action: "ترقية العميل إلى تصنيف Enterprise", user: "منى علي", timestamp: "2026-07-22 16:30:00" },
];

export default function CustomerHistoryPage() {
  const columns = [
    { header: "النشاط / الصفقة", accessorKey: "action" as const },
    { header: "مدير الحساب", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل المعاملات والصفقات المغلقة للعميل</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
