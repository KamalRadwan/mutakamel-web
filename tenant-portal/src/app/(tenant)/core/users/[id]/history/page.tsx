"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إنشاء حساب المستخدم وتفعيل الجلسة", user: "منى علي", timestamp: "2026-07-01 08:00:00" },
  { id: 2, action: "تغيير رقم الجوال المعتمد", user: "منى علي", timestamp: "2026-07-15 11:30:00" },
];

export default function UserHistoryPage() {
  const columns = [
    { header: "النشاط / التحديث", accessorKey: "action" as const },
    { header: "المُنفذ", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل تسجيلات الدخول وتغييرات الحساب</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
