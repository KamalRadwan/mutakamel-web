"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إنشاء سياسة الخصم التلقائي لطلبات الجملة", user: "مدير المبيعات", timestamp: "2026-07-01 10:00:00" },
  { id: 2, action: "تعديل الحد المالي إلى >= 100,000 ر.س", user: "أحمد محمود", timestamp: "2026-07-15 11:00:00" },
];

export default function PolicyHistoryPage() {
  const columns = [
    { header: "التعديل / تنشيط القاعدة Policy Event", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل اصدارات وتعديل سياسات وقواعد الأعمال</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
