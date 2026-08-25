"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Receipt } from "lucide-react";
import { useBillingInvoicesSubscription, InvoiceItem } from "./hooks/useBillingInvoicesSubscription";
import { CreateBillingInvoicesSubscriptionModal } from "./components/CreateBillingInvoicesSubscriptionModal";
import { DeleteBillingInvoicesSubscriptionConfirmModal } from "./components/DeleteBillingInvoicesSubscriptionConfirmModal";

export default function BillingInvoicesSubscriptionPage() {
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
  } = useBillingInvoicesSubscription();

  const columns = [
    {
      header: "رقم الفاتورة",
      cell: (item: InvoiceItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.invoiceNumber}</p>
            <p className="text-[11px] text-slate-400">{item.planName}</p>
          </div>
        </div>
      ),
    },
    {
      header: "المبلغ والعملة",
      cell: (item: InvoiceItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {item.amount} {item.currency}
        </span>
      ),
    },
    { header: "تاريخ الإصدار", accessorKey: "issueDate" as keyof InvoiceItem },
    { header: "تاريخ الاستحقاق", accessorKey: "dueDate" as keyof InvoiceItem },
    {
      header: "الحالة",
      cell: (item: InvoiceItem) => (
        <Badge variant={item.status === "paid" ? "success" : item.status === "pending" ? "warning" : "danger"}>
          {item.status === "paid" ? "مدفوعة" : item.status === "pending" ? "معلقة" : "متأخرة"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: InvoiceItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/billing-invoices-subscription/${item.id}/general`}>
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
        title="الفوترة، الفواتير واشتراك المستأجر (Billing & Subscriptions)"
        subtitle="إدارة الاشتراكات الشهرية/السنوية، دفع الفواتير المعلقة، ومعاينة التسعير المباشر"
        actionLabel="إصدار فاتورة جديدة"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث برقم الفاتورة أو اسم الاشتراك..."
      />

      <Table columns={columns} data={items} />

      <CreateBillingInvoicesSubscriptionModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteBillingInvoicesSubscriptionConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
