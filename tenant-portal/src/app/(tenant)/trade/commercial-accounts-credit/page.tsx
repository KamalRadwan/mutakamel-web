"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Building2 } from "lucide-react";
import { useCommercialAccountsCredit, CommercialAccountItem } from "./hooks/useCommercialAccountsCredit";
import { CreateCommercialAccountsCreditModal } from "./components/CreateCommercialAccountsCreditModal";
import { DeleteCommercialAccountsCreditConfirmModal } from "./components/DeleteCommercialAccountsCreditConfirmModal";

export default function CommercialAccountsCreditPage() {
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
  } = useCommercialAccountsCredit();

  const columns = [
    {
      header: "اسم الحساب التجاري",
      cell: (item: CommercialAccountItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.accountName}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.accountNumber}</p>
          </div>
        </div>
      ),
    },
    {
      header: "الحد الائتماني",
      cell: (item: CommercialAccountItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.creditLimit}</span>
      ),
    },
    {
      header: "الرصيد القائم",
      cell: (item: CommercialAccountItem) => (
        <span className="font-bold text-emerald-600">{item.currentBalance}</span>
      ),
    },
    { header: "شروط الدفع", accessorKey: "paymentTerms" as keyof CommercialAccountItem },
    {
      header: "حالة الائتمان",
      cell: (item: CommercialAccountItem) => (
        <Badge variant={item.creditStatus === "good" ? "success" : item.creditStatus === "warning" ? "warning" : "danger"}>
          {item.creditStatus === "good" ? "سليم (Good)" : item.creditStatus === "warning" ? "قارب الحد" : "محظور (Blocked)"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: CommercialAccountItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/commercial-accounts-credit/${item.id}/general`}>
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
        title="الحسابات التجارية الحدود الائتمانية (Commercial Accounts & Credit)"
        subtitle="إدارة الذمم، الحدود الائتمانية القصوى للتجار وشروط التحصيل الآجل والسيطرة المخاطر"
        actionLabel="إضافة حساب تجاري"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم الحساب أو الرقم التجاري..."
      />

      <Table columns={columns} data={items} />

      <CreateCommercialAccountsCreditModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCommercialAccountsCreditConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
