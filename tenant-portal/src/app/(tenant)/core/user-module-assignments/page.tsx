"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, UserCheck } from "lucide-react";
import { useUserModuleAssignments, UserModuleAssignmentItem } from "./hooks/useUserModuleAssignments";
import { CreateUserModuleAssignmentsModal } from "./components/CreateUserModuleAssignmentsModal";
import { DeleteUserModuleAssignmentsConfirmModal } from "./components/DeleteUserModuleAssignmentsConfirmModal";

export default function UserModuleAssignmentsPage() {
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
  } = useUserModuleAssignments();

  const columns = [
    {
      header: "المستخدم والبريد",
      cell: (item: UserModuleAssignmentItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.userName}</p>
            <p className="text-[11px] text-slate-400">{item.userEmail}</p>
          </div>
        </div>
      ),
    },
    {
      header: "الموديول المخصص",
      cell: (item: UserModuleAssignmentItem) => (
        <Badge variant="info">{item.moduleName}</Badge>
      ),
    },
    { header: "تاريخ الربط", accessorKey: "assignedAt" as keyof UserModuleAssignmentItem },
    {
      header: "الحالة",
      cell: (item: UserModuleAssignmentItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "نشط" : "معلق"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: UserModuleAssignmentItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/user-module-assignments/${item.id}/general`}>
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
        title="تخصيص موديولات المستخدمين (User-Module Assignments)"
        subtitle="ربط وإدارة الوصول لموديولات الـ CRM والتجارة والنظام الأساسي لمستخدمي المستأجر"
        actionLabel="ربط موديول جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم المستخدم أو الموديول..."
      />

      <Table columns={columns} data={items} />

      <CreateUserModuleAssignmentsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteUserModuleAssignmentsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
