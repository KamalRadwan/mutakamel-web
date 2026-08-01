"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "دخول المهمة في قائمة التجهيز Queue", duration: "100ms", timestamp: "2026-07-25 10:15:00" },
  { id: 2, action: "اكتمل معالجة وتخزين ملف الـ PDF 420 KB", duration: "1.2s", timestamp: "2026-07-25 10:15:01" },
];

export default function PdfJobHistoryPage() {
  const columns = [
    { header: "مرحلة التوليد Rendering Step", accessorKey: "action" as const },
    { header: "الزمن المستغرق", accessorKey: "duration" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل زمن معالجة واستكمال طباعة المستند</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
