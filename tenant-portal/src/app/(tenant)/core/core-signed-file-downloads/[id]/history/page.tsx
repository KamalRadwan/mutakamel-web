"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "توليد رابط موقع جديد", user: "مستأجر - منى علي", ip: "192.168.1.50", timestamp: "2026-07-25 14:30:10" },
  { id: 2, action: "تنزيل الملف (Download Access)", user: "عميل خارجي", ip: "82.102.45.12", timestamp: "2026-07-25 15:10:02" },
];

export default function CoreSignedFileHistoryPage() {
  const columns = [
    { header: "الإجراء المنفذ", accessorKey: "action" as const },
    { header: "المستخدم / الفاعل", accessorKey: "user" as const },
    { header: "عنوان IP", accessorKey: "ip" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل النشاطات وعمليات التنزيل</h2>
      </div>

      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
