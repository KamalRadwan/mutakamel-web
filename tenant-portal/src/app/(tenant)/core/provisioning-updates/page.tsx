"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, RefreshCw } from "lucide-react";
import { useProvisioningUpdates, ProvisioningUpdateItem } from "./hooks/useProvisioningUpdates";
import { CreateProvisioningUpdatesModal } from "./components/CreateProvisioningUpdatesModal";
import { DeleteProvisioningUpdatesConfirmModal } from "./components/DeleteProvisioningUpdatesConfirmModal";

export default function ProvisioningUpdatesPage() {
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
  } = useProvisioningUpdates();

  const columns = [
    {
      header: "إصدار التحديث",
      cell: (item: ProvisioningUpdateItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.version}</p>
            <p className="text-[11px] text-slate-400">{item.targetComponent}</p>
          </div>
        </div>
      ),
    },
    { header: "ملاحظات التحديث", accessorKey: "releaseNotes" as keyof ProvisioningUpdateItem },
    { header: "تاريخ التطبيق", accessorKey: "appliedAt" as keyof ProvisioningUpdateItem },
    {
      header: "الحالة",
      cell: (item: ProvisioningUpdateItem) => (
        <Badge variant={item.status === "applied" ? "success" : item.status === "pending" ? "warning" : "danger"}>
          {item.status === "applied" ? "مطبق بنجاح" : item.status === "pending" ? "بانتظار التطبيق" : "فشل"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: ProvisioningUpdateItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/provisioning-updates/${item.id}/general`}>
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
        title="تحديثات البنية والتزويد (Provisioning Updates)"
        subtitle="استعراض وتطبيق تحديثات قاعدة البيانات والسيرفرات الخاصة بحساب المستأجر"
        actionLabel="جدولة تحديث جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث بالإصدار أو المكون..."
      />

      <Table columns={columns} data={items} />

      <CreateProvisioningUpdatesModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteProvisioningUpdatesConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
