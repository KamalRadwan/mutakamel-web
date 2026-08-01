"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إقرار صيغة العقد الموحدة في crm-app", user: "مهندس المعمارية", timestamp: "2026-07-01 00:00:00" },
  { id: 2, action: "تأكيد فحص 0 أخطاء في الـ Envelope", user: "اختبارات النظام", timestamp: "2026-07-24 12:00:00" },
];

export default function ContractHistoryPage() {
  const columns = [
    { header: "الحدث / الاعتماد", accessorKey: "action" as const },
    { header: "المسؤول", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل اعتماد وتعديل قواعد العقد</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
