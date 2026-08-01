"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "تأكيد فحص الصحة FQDN Validation", result: "ناجح (200 OK)", timestamp: "2026-07-25 15:00:00" },
  { id: 2, action: "تجديد شهادة التشفير SSL", result: "تم التجديد", timestamp: "2026-07-01 00:00:00" },
];

export default function HostStatusHistoryPage() {
  const columns = [
    { header: "الفحص / الحدث", accessorKey: "action" as const },
    { header: "النتيجة", accessorKey: "result" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل فحوصات السلامة للخدمة (Health Check Logs)</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
