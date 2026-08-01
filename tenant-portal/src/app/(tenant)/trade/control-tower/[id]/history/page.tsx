"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "تغير قيمة سرعة التدوير من 4.2x إلى 4.8x", user: "محرك التحليلات التلقائي", timestamp: "2026-07-25 08:00:00" },
  { id: 2, action: "ضبط الحد المستهدف عند 5.0x", user: "أحمد محمود", timestamp: "2026-07-20 14:00:00" },
];

export default function ControlTowerHistoryPage() {
  const columns = [
    { header: "التغير والتحديث في المؤشر", accessorKey: "action" as const },
    { header: "المصدر / المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل التغييرات والتنبيهات السابقة للمؤشر</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
