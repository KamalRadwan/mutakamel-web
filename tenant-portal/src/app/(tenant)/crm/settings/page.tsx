"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Sliders, Settings2, ShieldCheck } from "lucide-react";
import { useCrmModuleSettings, CrmModuleSettingItem } from "./hooks/useCrmModuleSettings";
import { CreateCrmModuleSettingsModal } from "./components/CreateCrmModuleSettingsModal";
import { DeleteCrmModuleSettingsConfirmModal } from "./components/DeleteCrmModuleSettingsConfirmModal";

export default function CrmModuleSettingsPage() {
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
  } = useCrmModuleSettings();

  const columns = [
    {
      header: "اسم الإعداد",
      cell: (item: CrmModuleSettingItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.settingName}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.key}</p>
          </div>
        </div>
      ),
    },
    {
      header: "القيمة المعينة",
      cell: (item: CrmModuleSettingItem) => (
        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{item.value}</span>
      ),
    },
    {
      header: "المجموعة",
      cell: (item: CrmModuleSettingItem) => (
        <Badge variant="info">{item.group.toUpperCase()}</Badge>
      ),
    },
    {
      header: "الحالة",
      cell: (item: CrmModuleSettingItem) => (
        <Badge variant="success">نشط ومطبق</Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: CrmModuleSettingItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/settings/${item.id}/general`}>
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
        title="إعدادات موديول إدارة العملاء (CRM General Settings)"
        subtitle="تخصيص قواعد التوزيع الآلي، حدود الخصومات للمندوبين وخوادم البريد لموديول CRM"
        actionLabel="إضافة إعداد جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم الإعداد أو المفتاح أو القيمة..."
      />

      <Table columns={columns} data={items} />

      <CreateCrmModuleSettingsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCrmModuleSettingsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
