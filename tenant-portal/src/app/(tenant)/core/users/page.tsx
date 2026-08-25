"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, UserCheck } from "lucide-react";
import { useUsers, UserItem } from "./hooks/useUsers";
import { CreateUsersModal } from "./components/CreateUsersModal";
import { DeleteUsersConfirmModal } from "./components/DeleteUsersConfirmModal";

export default function UsersPage() {
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
  } = useUsers();

  const columns = [
    {
      header: "المستخدم",
      cell: (item: UserItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.fullName}</p>
            <p className="text-[11px] text-slate-400">{item.email} · {item.phone}</p>
          </div>
        </div>
      ),
    },
    {
      header: "الدور الوظيفي",
      cell: (item: UserItem) => (
        <Badge variant="info">{item.roleName}</Badge>
      ),
    },
    { header: "الفرع", accessorKey: "branch" as keyof UserItem },
    {
      header: "الحالة",
      cell: (item: UserItem) => (
        <Badge variant={item.status === "active" ? "success" : item.status === "invited" ? "warning" : "danger"}>
          {item.status === "active" ? "نشط" : item.status === "invited" ? "بانتظار القبول" : "معلق"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: UserItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/users/${item.id}/general`}>
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
        title="إدارة مستخدمي المستأجر (Users Management)"
        subtitle="دليل مستخدمي المنصة، الإجبار على تغيير كلمة المرور، وتحديد الفروع المسموحة"
        actionLabel="دعوة مستخدم جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم المستخدم، البريد، أو الدور..."
      />

      <Table columns={columns} data={items} />

      <CreateUsersModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteUsersConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
