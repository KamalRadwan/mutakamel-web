"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "نشر الترقية للنسخة v3.2.0 واعتماد 4 مراحل", user: "مدير العمليات", timestamp: "2026-07-01 09:00:00" },
  { id: 2, action: "إضافة مرحلة الموافقة المالية من نائب رئيس مجلس الإدارة", user: "أحمد محمود", timestamp: "2026-07-01 09:15:00" },
];

export default function WorkflowVersionHistoryPage() {
  const columns = [
    { header: "الترقية / تعديل خطوة الاعتماد Workflow Event", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل اصدارات وتعديل مسارات العمل</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
