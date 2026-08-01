"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Shield, Smartphone, Laptop } from "lucide-react";
import { useAuthenticationManagement, AuthSessionItem } from "./hooks/useAuthenticationManagement";
import { CreateAuthenticationModal } from "./components/CreateAuthenticationModal";
import { DeleteAuthenticationConfirmModal } from "./components/DeleteAuthenticationConfirmModal";

export default function AuthenticationManagementPage() {
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
  } = useAuthenticationManagement();

  const columns = [
    {
      header: "المستخدم",
      cell: (item: AuthSessionItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.userEmail}</p>
            <p className="text-[11px] text-slate-400">{item.device}</p>
          </div>
        </div>
      ),
    },
    { header: "عنوان الـ IP", accessorKey: "ipAddress" as keyof AuthSessionItem },
    { header: "آخر نشاط", accessorKey: "lastActive" as keyof AuthSessionItem },
    {
      header: "الحالة",
      cell: (item: AuthSessionItem) => (
        <Badge variant={item.status === "active" ? "success" : "danger"}>
          {item.status === "active" ? "نشطة" : "ملغاة"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: AuthSessionItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/authentication/${item.id}/general`}>
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
        title="إدارة مصادقة وتوثيق المستخدمين (Authentication)"
        subtitle="مراقبة الجلسات النشطة، رموز التوثيق، وإجراءات الخروج لجميع مستخدمي المستأجر"
        actionLabel="إنشاء توثيق جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث بالبريد الإلكتروني أو IP..."
      />

      <Table columns={columns} data={items} />

      <CreateAuthenticationModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteAuthenticationConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
