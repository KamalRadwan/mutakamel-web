"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Receipt } from "lucide-react";
import { useTradeInvoicesContracts, InvoiceContractItem } from "./hooks/useTradeInvoicesContracts";
import { CreateTradeInvoicesContractsModal } from "./components/CreateTradeInvoicesContractsModal";
import { DeleteTradeInvoicesContractsConfirmModal } from "./components/DeleteTradeInvoicesContractsConfirmModal";

export default function TradeInvoicesContractsPage() {
  const {
    items,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
  } = useTradeInvoicesContracts();

  const columns = [
    {
      header: "رقم المستند والعميل",
      cell: (item: InvoiceContractItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.documentNumber}</p>
            <p className="text-[11px] text-slate-400">{item.customerName}</p>
          </div>
        </div>
      ),
    },
    {
      header: "نوع المستند",
      cell: (item: InvoiceContractItem) => (
        <Badge variant="info">{item.documentType.toUpperCase()}</Badge>
      ),
    },
    {
      header: "المبلغ الإجمالي",
      cell: (item: InvoiceContractItem) => (
        <span className="font-bold text-emerald-600">{item.totalAmount}</span>
      ),
    },
    { header: "الضريبة", accessorKey: "taxAmount" as keyof InvoiceContractItem },
    { header: "تاريخ الإصدار", accessorKey: "issueDate" as keyof InvoiceContractItem },
    {
      header: "حالة التحصيل",
      cell: (item: InvoiceContractItem) => (
        <Badge variant={item.paymentStatus === "paid" ? "success" : item.paymentStatus === "partially_paid" ? "warning" : "danger"}>
          {item.paymentStatus === "paid" ? "مسددة بالكامل" : item.paymentStatus === "partially_paid" ? "مسددة جزئياً" : "غير مسددة / متأخرة"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: InvoiceContractItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/invoices-contracts/${item.id}/general`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => setSelectedForDelete(item)}>
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="الفواتير والعقود التجارية (Trade Invoices & Contracts)"
        subtitle="إصدار وإدارة الفواتير الضريبية والعقود السنوية المتكاملة مع هيئة الزكاة والضريبة والجمارك ZATCA"
        actionLabel="إصدار فاتورة / عقد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث برقم المستند أو اسم العميل..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeInvoicesContractsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeInvoicesContractsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
