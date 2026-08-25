"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, CalendarCheck, PhoneCall, Mail } from "lucide-react";
import { useActivities, ActivityItem } from "./hooks/useActivities";
import { CreateActivitiesModal } from "./components/CreateActivitiesModal";
import { DeleteActivitiesConfirmModal } from "./components/DeleteActivitiesConfirmModal";

export default function ActivitiesPage() {
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
  } = useActivities();

  const getIcon = (type: string) => {
    if (type.includes("هاتفي")) return <PhoneCall className="w-4 h-4 text-blue-600" />;
    if (type.includes("إلكتروني")) return <Mail className="w-4 h-4 text-purple-600" />;
    return <CalendarCheck className="w-4 h-4 text-emerald-600" />;
  };

  const columns = [
    {
      header: "عنوان النشاط",
      cell: (item: ActivityItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
            {getIcon(item.activityType)}
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
            <p className="text-[11px] text-slate-400">{item.activityType}</p>
          </div>
        </div>
      ),
    },
    { header: "المسؤول", accessorKey: "assignee" as keyof ActivityItem },
    { header: "تاريخ الاستحقاق", accessorKey: "dueDate" as keyof ActivityItem },
    {
      header: "الأولوية",
      cell: (item: ActivityItem) => (
        <Badge variant={item.priority === "high" ? "danger" : item.priority === "medium" ? "warning" : "info"}>
          {item.priority.toUpperCase()}
        </Badge>
      ),
    },
    {
      header: "الحالة",
      cell: (item: ActivityItem) => (
        <Badge variant={item.status === "completed" ? "success" : item.status === "open" ? "info" : "neutral"}>
          {item.status === "completed" ? "مكتملة" : item.status === "open" ? "مفتوحة" : "ملغاة"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: ActivityItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/activities/${item.id}/general`}>
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
        title="إدارة الأنشطة والمهام (Activities)"
        subtitle="جدولة ومتابعة الأنشطة، الاتصالات، والاجتماعات للمستأجر وفريق العمل"
        actionLabel="إضافة نشاط جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث بالاسم أو المسير..."
      />

      <Table columns={columns} data={items} />

      <CreateActivitiesModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteActivitiesConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
