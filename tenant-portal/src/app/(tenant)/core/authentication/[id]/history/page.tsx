"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إنشاء الجلسة عبر Auth Login", ip: "197.38.12.4", timestamp: "2026-07-25 12:00:00" },
  { id: 2, action: "تجديد الرمز Refresh Token", ip: "197.38.12.4", timestamp: "2026-07-25 13:00:00" },
];

export default function AuthenticationHistoryPage() {
  const columns = [
    { header: "الإجراء", accessorKey: "action" as const },
    { header: "عنوان الـ IP", accessorKey: "ip" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل أحداث الجلسة والتجديدات</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
