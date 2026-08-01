"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Building2, GitFork, Users } from "lucide-react";
import { useOrganization, OrgUnitItem } from "./hooks/useOrganization";
import { CreateOrganizationModal } from "./components/CreateOrganizationModal";
import { DeleteOrganizationConfirmModal } from "./components/DeleteOrganizationConfirmModal";

export default function OrganizationPage() {
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
  } = useOrganization();

  const columns = [
    {
      header: "الوحدة التنظيمية",
      cell: (item: OrgUnitItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] text-slate-400">الكود: {item.code} · التبعية: {item.parentUnit}</p>
          </div>
        </div>
      ),
    },
    {
      header: "النوع",
      cell: (item: OrgUnitItem) => (
        <Badge variant={item.unitType === "company" ? "info" : item.unitType === "branch" ? "success" : "neutral"}>
          {item.unitType === "company" ? "شركة" : item.unitType === "branch" ? "فرع" : item.unitType === "department" ? "قسم" : "فريق"}
        </Badge>
      ),
    },
    { header: "المدير المسؤول", accessorKey: "manager" as keyof OrgUnitItem },
    {
      header: "الحالة",
      cell: (item: OrgUnitItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "نشطة" : "غير نشطة"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: OrgUnitItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/organization/${item.id}/general`}>
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
        title="الهيكل التنظيمي (Organization Structure)"
        subtitle="إدارة الشجرة الهيكلية، الشركات التابعة، الفروع، الأقسام، وفرق العمل للمستأجر"
        actionLabel="إضافة وحدة تنظيمية"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم الوحدة، الكود، أو المدير..."
      />

      <Table columns={columns} data={items} />

      <CreateOrganizationModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteOrganizationConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
