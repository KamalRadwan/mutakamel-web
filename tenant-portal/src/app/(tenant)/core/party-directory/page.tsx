"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Building, UserCheck } from "lucide-react";
import { usePartyDirectory, PartyItem } from "./hooks/usePartyDirectory";
import { CreatePartyDirectoryModal } from "./components/CreatePartyDirectoryModal";
import { DeletePartyDirectoryConfirmModal } from "./components/DeletePartyDirectoryConfirmModal";

export default function PartyDirectoryPage() {
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
  } = usePartyDirectory();

  const columns = [
    {
      header: "الجهة / الاسم",
      cell: (item: PartyItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            {item.partyType === "organization" ? <Building className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] text-slate-400">{item.email} · {item.phone}</p>
          </div>
        </div>
      ),
    },
    {
      header: "نوع الكيان",
      cell: (item: PartyItem) => (
        <Badge variant={item.partyType === "organization" ? "info" : "neutral"}>
          {item.partyType === "organization" ? "منظمة / شركة" : "فرد"}
        </Badge>
      ),
    },
    {
      header: "الأدوار والتصنيفات",
      cell: (item: PartyItem) => (
        <div className="flex flex-wrap gap-1">
          {item.roles.map((r, i) => (
            <Badge key={i} variant="warning">{r}</Badge>
          ))}
        </div>
      ),
    },
    {
      header: "الحالة",
      cell: (item: PartyItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "نشط" : "غير نشط"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: PartyItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/party-directory/${item.id}/general`}>
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
        title="دليل الجهات والأطراف (Party Directory)"
        subtitle="سجل موحد لجميع الكيانات والأفراد، الموردين، العملاء، والعناوين التابعة للمستأجر"
        actionLabel="إضافة جهة جديدة"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم الجهة، البريد، أو الهاتف..."
      />

      <Table columns={columns} data={items} />

      <CreatePartyDirectoryModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeletePartyDirectoryConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
