"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2 } from "lucide-react";
import { useWorkspaceSettingsBranding, WorkspaceProfileItem } from "./hooks/useWorkspaceSettingsBranding";
import { CreateWorkspaceSettingsBrandingModal } from "./components/CreateWorkspaceSettingsBrandingModal";
import { DeleteWorkspaceSettingsBrandingConfirmModal } from "./components/DeleteWorkspaceSettingsBrandingConfirmModal";

export default function WorkspaceSettingsBrandingPage() {
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
  } = useWorkspaceSettingsBranding();

  const columns = [
    {
      header: "مساحة العمل والهوية",
      cell: (item: WorkspaceProfileItem) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-white shadow-sm" style={{ backgroundColor: item.primaryColor }}>
            {item.tenantName[0]}
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.tenantName}</p>
            <p className="text-[11px] text-slate-400">{item.defaultTimezone}</p>
          </div>
        </div>
      ),
    },
    {
      header: "اللون الرئيسي",
      cell: (item: WorkspaceProfileItem) => (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border border-slate-300" style={{ backgroundColor: item.primaryColor }} />
          <span className="font-mono text-xs">{item.primaryColor}</span>
        </div>
      ),
    },
    {
      header: "اللغة الافتراضية",
      cell: (item: WorkspaceProfileItem) => (
        <Badge variant="info">{item.locale === "ar" ? "العربية (RTL)" : "English (LTR)"}</Badge>
      ),
    },
    {
      header: "الحالة",
      cell: (item: WorkspaceProfileItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "نشطة ومطبقة" : "جاري التحديث"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: WorkspaceProfileItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/workspace-settings-branding/${item.id}/general`}>
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
        title="إعدادات الهوية ومساحة العمل (Workspace Settings & Branding)"
        subtitle="تخصيص الألوان، الشعار الرسمي، المنطقة الزمنية واللغة الافتراضية لبوابة المستأجر"
        actionLabel="إضافة ملف هوية جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم مساحة العمل أو المنطقة..."
      />

      <Table columns={columns} data={items} />

      <CreateWorkspaceSettingsBrandingModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteWorkspaceSettingsBrandingConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
