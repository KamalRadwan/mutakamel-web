"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "اختبار الاتصال بالخادم SMTP Test", result: "ناجح (250 OK)", timestamp: "2026-07-25 15:20:00" },
  { id: 2, action: "تحديث بريد المرسل", result: "تم التحديث", timestamp: "2026-07-10 11:00:00" },
];

export default function NotificationConfigHistoryPage() {
  const columns = [
    { header: "الإجراء / الاختبار", accessorKey: "action" as const },
    { header: "النتيجة", accessorKey: "result" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل اختبارات الإرسال وتوثيق خوادم البريد</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
