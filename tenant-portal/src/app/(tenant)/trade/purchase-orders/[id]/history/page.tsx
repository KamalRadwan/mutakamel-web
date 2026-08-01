"use client";

import { Table } from "@/components/ui/Table";

const historyLogs = [
  { id: 1, action: "إصدار وتعميد أمر الشراء PO-2026-7701 بمبلغ 850,000 ر.س", user: "مدير المشتريات", timestamp: "2026-07-01 11:00:00" },
  { id: 2, action: "تلقي تأكيد المورد وتحديد تاريخ التسليم 2026-08-10", user: "مستلم التوريدات", timestamp: "2026-07-05 14:00:00" },
];

export default function PurchaseOrderHistoryPage() {
  const columns = [
    { header: "التعميد / حركة الاستلام PO Event", accessorKey: "action" as const },
    { header: "المستخدم", accessorKey: "user" as const },
    { header: "التاريخ والوقت", accessorKey: "timestamp" as const },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">سجل تعميدات واستلام أمر الشراء</h2>
      </div>
      <Table columns={columns} data={historyLogs} />
    </div>
  );
}
