"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Mail, Send, CheckCircle2 } from "lucide-react";
import { useOutboundEmails, OutboundEmailItem } from "./hooks/useOutboundEmails";
import { CreateOutboundEmailsModal } from "./components/CreateOutboundEmailsModal";
import { DeleteOutboundEmailsConfirmModal } from "./components/DeleteOutboundEmailsConfirmModal";

export default function OutboundEmailsPage() {
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
  } = useOutboundEmails();

  const columns = [
    {
      header: "المستقبل والبريد",
      cell: (item: OutboundEmailItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.recipientName}</p>
            <p className="text-[11px] text-slate-400">{item.recipientEmail}</p>
          </div>
        </div>
      ),
    },
    { header: "عنوان الرسالة", accessorKey: "subject" as keyof OutboundEmailItem },
    { header: "تاريخ الإرسال", accessorKey: "sentAt" as keyof OutboundEmailItem },
    {
      header: "حالة التسليم",
      cell: (item: OutboundEmailItem) => (
        <Badge variant={item.deliveryStatus === "opened" ? "success" : item.deliveryStatus === "delivered" ? "info" : "warning"}>
          {item.deliveryStatus === "opened" ? "تم التفتيح" : item.deliveryStatus === "delivered" ? "تم التسليم" : "قيد الإرسال"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: OutboundEmailItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/outbound-emails/${item.id}/general`}>
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
        title="رسائل البريد الصادرة (Outbound Emails Tracking)"
        subtitle="متابعة حالة الرسائل الصادرة للعملاء وتتبع فتح البريد والنقر على الروابط"
        actionLabel="إرسال رسالة بريد جديدة"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث بالعنوان أو البريد..."
      />

      <Table columns={columns} data={items} />

      <CreateOutboundEmailsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteOutboundEmailsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
