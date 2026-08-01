"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إنشاء وحدة القياس كرتونة سعة 24 حبة", user: "مدير المخزون", timestamp: "2026-07-01 08:00:00" },
  { id: 2, action: "ربط وحدة القياس بمنتجات الأجهزة الطبية", user: "أحمد محمود", timestamp: "2026-07-10 14:00:00" },
];

export default function CatalogUomHistoryPage() {
  const columns = [
    { header: "التعديل / الربط", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل الاستعمال وتغيير معامل التحويل</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
