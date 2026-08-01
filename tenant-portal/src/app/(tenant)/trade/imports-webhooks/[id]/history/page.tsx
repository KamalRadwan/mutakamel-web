"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "رفع واستيراد 1,420 منتج من ملف Excel", user: "أحمد محمود", timestamp: "2026-07-25 11:30:00" },
  { id: 2, action: "معالجة 0 أخطاء ونجاح كامل الصفوف", user: "محرك الاستيراد", timestamp: "2026-07-25 11:31:00" },
];

export default function ImportWebhookHistoryPage() {
  const columns = [
    { header: "التشغيل / السجلات المعالجة", accessorKey: "action" as const },
    { header: "المستخدم / المحرك", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل استدعاءات وتوليد الاستيراد والـ Webhooks</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
