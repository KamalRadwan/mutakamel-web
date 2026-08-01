"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Building2, UserCheck, DollarSign } from "lucide-react";
import { useCustomerProfiles, CustomerProfileItem } from "./hooks/useCustomerProfiles";
import { CreateCustomerProfilesModal } from "./components/CreateCustomerProfilesModal";
import { DeleteCustomerProfilesConfirmModal } from "./components/DeleteCustomerProfilesConfirmModal";

export default function CustomerProfilesPage() {
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
  } = useCustomerProfiles();

  const columns = [
    {
      header: "اسم العميل / الشركة",
      cell: (item: CustomerProfileItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] text-slate-400">{item.contactPerson} · {item.phone}</p>
          </div>
        </div>
      ),
    },
    {
      header: "التصنيف",
      cell: (item: CustomerProfileItem) => (
        <Badge variant={item.category === "VIP" ? "warning" : item.category === "Enterprise" ? "info" : "neutral"}>
          {item.category}
        </Badge>
      ),
    },
    {
      header: "إجمالي قيمة الصفقات",
      cell: (item: CustomerProfileItem) => (
        <span className="font-bold text-emerald-600">{item.totalDealsValue}</span>
      ),
    },
    {
      header: "الحالة",
      cell: (item: CustomerProfileItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "عميل نشط" : "غير نشط"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: CustomerProfileItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/customer-profiles/${item.id}/general`}>
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
        title="ملفات وبطاقات العملاء (Customer Profiles)"
        subtitle="سجل شامل 360 درجة لبيانات العملاء، المعاملات المباشرة، وقيمة الصفقات المغلقة"
        actionLabel="إضافة عميل جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم الشركة، المسؤول، أو البريد..."
      />

      <Table columns={columns} data={items} />

      <CreateCustomerProfilesModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCustomerProfilesConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
