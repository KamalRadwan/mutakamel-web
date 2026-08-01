"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Mail, Bell, Server } from "lucide-react";
import { useNotificationsEmailConfig, NotificationConfigItem } from "./hooks/useNotificationsEmailConfig";
import { CreateNotificationsEmailConfigModal } from "./components/CreateNotificationsEmailConfigModal";
import { DeleteNotificationsEmailConfigConfirmModal } from "./components/DeleteNotificationsEmailConfigConfirmModal";

export default function NotificationsEmailConfigPage() {
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
  } = useNotificationsEmailConfig();

  const columns = [
    {
      header: "قناة الإشعارات / البريد",
      cell: (item: NotificationConfigItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <Mail className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.channel}</p>
            <p className="text-[11px] text-slate-400">{item.senderEmail}</p>
          </div>
        </div>
      ),
    },
    { header: "خادم SMTP Host", accessorKey: "smtpHost" as keyof NotificationConfigItem },
    { header: "Port", accessorKey: "port" as keyof NotificationConfigItem },
    {
      header: "حالة الربط",
      cell: (item: NotificationConfigItem) => (
        <Badge variant={item.status === "verified" ? "success" : "warning"}>
          {item.status === "verified" ? "مفعل وموثق" : "بانتظار التحقق"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: NotificationConfigItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/notifications-email-configuration/${item.id}/general`}>
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
        title="إعدادات التنبيهات والبريد الإلكتروني (Notifications & Email Config)"
        subtitle="ضبط قنوات خوادم SMTP، مفاتيح FCM التنبيهية، وتفضيلات الإرسال للمستأجر"
        actionLabel="إضافة خادم بريد جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم القناة أو بريد المرسل..."
      />

      <Table columns={columns} data={items} />

      <CreateNotificationsEmailConfigModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteNotificationsEmailConfigConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
