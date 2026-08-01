"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إضافة الجهة إلى دفتر العناوين", user: "أحمد محمود", timestamp: "2026-07-10 11:00:00" },
  { id: 2, action: "ربط دور (مورد معتمد)", user: "منى علي", timestamp: "2026-07-12 14:30:00" },
];

export default function PartyHistoryPage() {
  const columns = [
    { header: "الإجراء / الحركة", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل النشاط والأدوار المربوطة بالجهة</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
