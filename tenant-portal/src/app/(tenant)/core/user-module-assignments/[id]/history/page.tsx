"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "ربط موديول الـ CRM للمستخدم", user: "مدير النظام", timestamp: "2026-07-10 09:00:00" },
  { id: 2, action: "تأكيد تفعيل الوصول المباشر", user: "منى علي", timestamp: "2026-07-10 09:05:00" },
];

export default function UserModuleHistoryPage() {
  const columns = [
    { header: "الحدث / التعيين", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل تعيينات وتراخيص الموديولات</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
