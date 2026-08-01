"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إنشاء الفرع في الشجرة الهيكلية", user: "منى علي", timestamp: "2026-07-01 09:00:00" },
  { id: 2, action: "تعيين أحمد محمود كمدير للفرع", user: "مدير النظام", timestamp: "2026-07-05 10:15:00" },
];

export default function OrgHistoryPage() {
  const columns = [
    { header: "تعديل الهيكل التنظيمي", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل التغييرات الهيكلية للوحدة</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
