"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إضافة الحقل المخصص للنموذج", user: "أحمد محمود", timestamp: "2026-07-15 09:00:00" },
  { id: 2, action: "جعله حقل إجباري Required", user: "منى علي", timestamp: "2026-07-20 14:00:00" },
];

export default function CustomFieldHistoryPage() {
  const columns = [
    { header: "التعديل / التحديث", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل التغييرات على الحقل المخصص</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
