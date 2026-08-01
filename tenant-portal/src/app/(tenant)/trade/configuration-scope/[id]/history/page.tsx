"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إنشاء نطاق التهيئة الرئيسي HQ-RUH وتطبيق 24 ميزة", user: "مدير النظام", timestamp: "2026-07-01 09:00:00" },
  { id: 2, action: "تحديث شروط عزل المخزون وتوريث الأسعار", user: "أحمد محمود", timestamp: "2026-07-20 11:00:00" },
];

export default function ScopeHistoryPage() {
  const columns = [
    { header: "التعديل / تفعيل الميزات", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل التعديلات والتوريث لنطاق التهيئة</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
