"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Wallet, ArrowDownRight, ArrowUpRight, CreditCard } from "lucide-react";
import { useWalletPayments, TransactionItem } from "./hooks/useWalletPayments";
import { CreateWalletPaymentsModal } from "./components/CreateWalletPaymentsModal";
import { DeleteWalletPaymentsConfirmModal } from "./components/DeleteWalletPaymentsConfirmModal";

export default function WalletPaymentsPage() {
  const {
    t,
    items,
    searchQuery,
    setSearchQuery,
    isCreateOpen,
    setIsCreateOpen,
    selectedForDelete,
    setSelectedForDelete,
    handleCreate,
    handleDelete,
  } = useWalletPayments();

  const columns = [
    {
      header: "رقم المعاملة",
      cell: (item: TransactionItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.txNumber}</p>
            <p className="text-[11px] text-slate-400">{item.paymentGateway}</p>
          </div>
        </div>
      ),
    },
    {
      header: "نوع الحركة",
      cell: (item: TransactionItem) => (
        <Badge variant={item.type === "deposit" ? "success" : item.type === "charge" ? "info" : "warning"}>
          {item.type === "deposit" ? "شحن رصيد" : item.type === "charge" ? "خصم اشتراك" : "سحب"}
        </Badge>
      ),
    },
    {
      header: "المبلغ والعملة",
      cell: (item: TransactionItem) => (
        <span className={`font-bold ${item.type === "deposit" ? "text-emerald-600" : "text-slate-900 dark:text-slate-100"}`}>
          {item.type === "deposit" ? "+" : "-"}{item.amount} {item.currency}
        </span>
      ),
    },
    { header: "التاريخ", accessorKey: "createdAt" as keyof TransactionItem },
    {
      header: "الحالة",
      cell: (item: TransactionItem) => (
        <Badge variant={item.status === "success" ? "success" : item.status === "pending" ? "warning" : "danger"}>
          {item.status === "success" ? "مكتملة" : item.status === "pending" ? "قيد المعالجة" : "فشلت"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: TransactionItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/wallet-payments/${item.id}/general`}>
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
        title="محفظة المستأجر والمدفوعات (Wallet & Payments)"
        subtitle="متابعة الرصيد المتاح، شحن المحفظة، المعاملات البنكية المباشرة وسجل الاستقطاعات"
        actionLabel="إجراء معاملة جديدة"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث برقم المعاملة أو بوابة الدفع..."
      />

      <Table columns={columns} data={items} />

      <CreateWalletPaymentsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteWalletPaymentsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
