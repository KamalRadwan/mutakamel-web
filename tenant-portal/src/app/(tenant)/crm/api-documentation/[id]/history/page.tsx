"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "فحص وتحديث التوثيق وتطابق الـ DTO", user: "مهندس الواجهات", timestamp: "2026-07-24 16:00:00" },
  { id: 2, action: "تأكيد مسار البوابة Gateway Path", user: "أدمن النظام", timestamp: "2026-07-24 16:10:00" },
];

export default function ApiDocHistoryPage() {
  const columns = [
    { header: "الحدث / المطابقة", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل مراجعات ومطابقة عقد الـ API</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
