"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إضافة الـ Widget إلى الشاشة الرئيسية", user: "مدير المبيعات", timestamp: "2026-07-01 10:00:00" },
  { id: 2, action: "تحديث المقياس إلى CRM Leads Funnel", user: "منى علي", timestamp: "2026-07-18 12:00:00" },
];

export default function WidgetHistoryPage() {
  const columns = [
    { header: "النشاط / التخصيص", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل إعدادات ومواضع الـ Widget</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
