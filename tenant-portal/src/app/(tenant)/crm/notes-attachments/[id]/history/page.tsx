"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "رفع الملف المرفق Technical_Proposal_v2.pdf", user: "أحمد محمود", timestamp: "2026-07-22 10:00:00" },
  { id: 2, action: "إضافة الملاحظة الفنية على الصفقة", user: "أحمد محمود", timestamp: "2026-07-22 10:05:00" },
];

export default function NoteHistoryPage() {
  const columns = [
    { header: "الحدث / الملف", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل رفع وتحميل المرفقات والتغييرات</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
