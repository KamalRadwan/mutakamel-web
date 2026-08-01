"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إضافة نموذج استدعاء المتصفح", result: "201 Created", timestamp: "2026-07-20 10:00:00" },
  { id: 2, action: "اختبار إرسال الطلب في بيئة الـ Sandbox", result: "200 OK (Clean)", timestamp: "2026-07-25 11:30:00" },
];

export default function BrowserExampleHistoryPage() {
  const columns = [
    { header: "النموذج / الاستدعاء", accessorKey: "action" as const },
    { header: "نتيجة الاختبار", accessorKey: "result" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل اختبارات وتجربة نماذج المتصفح</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
