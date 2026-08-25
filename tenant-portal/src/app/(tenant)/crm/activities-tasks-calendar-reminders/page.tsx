"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Calendar } from "lucide-react";
import { useCrmActivitiesTasks, CrmTaskItem } from "./hooks/useCrmActivitiesTasks";
import { CreateCrmActivitiesTasksModal } from "./components/CreateCrmActivitiesTasksModal";
import { DeleteCrmActivitiesTasksConfirmModal } from "./components/DeleteCrmActivitiesTasksConfirmModal";

export default function CrmActivitiesTasksPage() {
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
  } = useCrmActivitiesTasks();

  const columns = [
    {
      header: t.crm.taskTopic,
      cell: (item: CrmTaskItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <Calendar className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.subject}</p>
            <p className="text-[11px] text-slate-400">{item.leadOrCustomer}</p>
          </div>
        </div>
      ),
    },
    {
      header: t.crm.type,
      cell: (item: CrmTaskItem) => (
        <Badge variant={item.taskType === "demo" ? "info" : item.taskType === "meeting" ? "success" : "neutral"}>
          {item.taskType.toUpperCase()}
        </Badge>
      ),
    },
    { header: t.crm.dateAndTime, accessorKey: "dueDate" as keyof CrmTaskItem },
    {
      header: t.crm.theCondition,
      cell: (item: CrmTaskItem) => (
        <Badge variant={item.status === "done" ? "success" : "warning"}>
          {item.status === "done" ? t.crm.completed : t.crm.underFollowUp}
        </Badge>
      ),
    },
    {
      header: t.crm.procedures,
      cell: (item: CrmTaskItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/activities-tasks-calendar-reminders/${item.id}/general`}>
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
        title={t.crm.cRMActivitiesAndAdministrat}
        subtitle={t.crm.schedulingMeetingsCallsDe}
        actionLabel={t.crm.scheduleANewTask}
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={t.crm.searchBySubjectOrCustomer}
      />

      <Table columns={columns} data={items} />

      <CreateCrmActivitiesTasksModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCrmActivitiesTasksConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
