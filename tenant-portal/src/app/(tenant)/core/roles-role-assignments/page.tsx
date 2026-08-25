"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, KeyRound } from "lucide-react";
import { useRolesRoleAssignments, RoleItem } from "./hooks/useRolesRoleAssignments";
import { CreateRolesRoleAssignmentsModal } from "./components/CreateRolesRoleAssignmentsModal";
import { DeleteRolesRoleAssignmentsConfirmModal } from "./components/DeleteRolesRoleAssignmentsConfirmModal";

export default function RolesRoleAssignmentsPage() {
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
  } = useRolesRoleAssignments();

  const columns = [
    {
      header: "اسم الدور",
      cell: (item: RoleItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <KeyRound className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] text-slate-400">{item.code}</p>
          </div>
        </div>
      ),
    },
    { header: "الوصف", accessorKey: "description" as keyof RoleItem },
    {
      header: "عدد الصلاحيات",
      cell: (item: RoleItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.permissionsCount} صلاحية</span>
      ),
    },
    {
      header: "المستخدمين المنسوبين",
      cell: (item: RoleItem) => (
        <Badge variant="info">{item.usersAssignedCount} مستخدم</Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: RoleItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/roles-role-assignments/${item.id}/general`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          {!item.isSystem && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedForDelete(item)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="إدارة الأدوار وتخصيص الصلاحيات (Roles & Role Assignments)"
        subtitle="إنشاء أدوار العمل، تخصيص مصفوفة الصلاحيات، وإسناد الأدوار لمستخدمي المستأجر"
        actionLabel="إنشاء دور جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم الدور أو الكود البرمجي..."
      />

      <Table columns={columns} data={items} />

      <CreateRolesRoleAssignmentsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteRolesRoleAssignmentsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
