"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "تحديث قائمة 48 قطاع اقتصادي", user: "محرك المزامنة", timestamp: "2026-07-20 08:00:00" },
  { id: 2, action: "إضافة قطاع التوريدات الطبية والصحية", user: "أحمد محمود", timestamp: "2026-07-22 14:00:00" },
];

export default function CatalogueHistoryPage() {
  const columns = [
    { header: "التعديل / التحديث المرجعي", accessorKey: "action" as const },
    { header: "المصدر / المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل مزامنة البيانات الثابتة والمرجعيات</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
