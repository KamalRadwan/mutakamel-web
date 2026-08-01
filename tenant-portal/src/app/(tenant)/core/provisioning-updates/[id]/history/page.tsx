"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إنشاء خطة التحديث في قائمة الانتظار", result: "بانتظار الموافقة", timestamp: "2026-07-20 08:00:00" },
  { id: 2, action: "تنفيذ التحديث بنجاح على خوادم المستأجر", result: "تم المزيج (Migrated)", timestamp: "2026-07-20 08:15:00" },
];

export default function ProvisioningUpdateHistoryPage() {
  const columns = [
    { header: "خطوة التحديث", accessorKey: "action" as const },
    { header: "النتيجة الفنية", accessorKey: "result" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل عمليات التزويد والترحيل (Migration Audit Logs)</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
