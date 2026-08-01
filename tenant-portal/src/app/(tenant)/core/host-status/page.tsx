"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Globe, ShieldCheck, Activity } from "lucide-react";
import { useHostStatus, HostStatusItem } from "./hooks/useHostStatus";
import { CreateHostStatusModal } from "./components/CreateHostStatusModal";
import { DeleteHostStatusConfirmModal } from "./components/DeleteHostStatusConfirmModal";

export default function HostStatusPage() {
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
  } = useHostStatus();

  const columns = [
    {
      header: "النطاق FQDN",
      cell: (item: HostStatusItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.fqdn}</p>
            <p className="text-[11px] text-slate-400">{item.subdomain} · IP: {item.ipAddress}</p>
          </div>
        </div>
      ),
    },
    {
      header: "شهادة SSL",
      cell: (item: HostStatusItem) => (
        <Badge variant={item.sslStatus === "valid" ? "success" : item.sslStatus === "renewing" ? "warning" : "danger"}>
          {item.sslStatus === "valid" ? "مشفرة وآمنة" : item.sslStatus === "renewing" ? "جاري التجديد" : "منتهية"}
        </Badge>
      ),
    },
    {
      header: "حالة النظام",
      cell: (item: HostStatusItem) => (
        <Badge variant={item.healthCheck === "healthy" ? "success" : item.healthCheck === "degraded" ? "warning" : "danger"}>
          {item.healthCheck === "healthy" ? "سليم (Healthy)" : item.healthCheck === "degraded" ? "بطيء" : "متوقف"}
        </Badge>
      ),
    },
    { header: "آخر فحص", accessorKey: "lastChecked" as keyof HostStatusItem },
    {
      header: "الإجراءات",
      cell: (item: HostStatusItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/host-status/${item.id}/general`}>
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
        title="حالة النطاق والخوادم (Tenant Host-Status)"
        subtitle="مراقبة حالة الفحص الحي لنطاق المستأجر (FQDN)، شهادات التشفير SSL، وتدقيق التوجيه"
        actionLabel="إضافة نطاق جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث بالنطاق الفعلي أو الـ Subdomain..."
      />

      <Table columns={columns} data={items} />

      <CreateHostStatusModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteHostStatusConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
