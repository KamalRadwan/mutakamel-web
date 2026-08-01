"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إرسال البريد عبر سيرفر الـ SMTP", status: "تم التسليم", timestamp: "2026-07-25 09:30:00" },
  { id: 2, action: "فتح الرسالة من قبل المستلم", status: "Opened (Safari iOS)", timestamp: "2026-07-25 09:32:00" },
];

export default function OutboundEmailHistoryPage() {
  const columns = [
    { header: "الحدث / الحركة", accessorKey: "action" as const },
    { header: "الحالة الفنية", accessorKey: "status" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل التفتيح والتسليم للرسالة الصادرة</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
