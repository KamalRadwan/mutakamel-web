"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Globe, Play, FileJson } from "lucide-react";
import { useCrmBrowserExamples, BrowserExampleItem } from "./hooks/useCrmBrowserExamples";
import { CreateCrmBrowserExamplesModal } from "./components/CreateCrmBrowserExamplesModal";
import { DeleteCrmBrowserExamplesConfirmModal } from "./components/DeleteCrmBrowserExamplesConfirmModal";

export default function CrmBrowserExamplesPage() {
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
  } = useCrmBrowserExamples();

  const columns = [
    {
      header: "اسم النموذج",
      cell: (item: BrowserExampleItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.targetEndpoint}</p>
          </div>
        </div>
      ),
    },
    {
      header: "الكود المتوقع",
      cell: (item: BrowserExampleItem) => (
        <Badge variant={item.httpStatusExpected < 300 ? "success" : "warning"}>{item.httpStatusExpected} OK</Badge>
      ),
    },
    {
      header: "البيئة",
      cell: (item: BrowserExampleItem) => (
        <Badge variant={item.environment === "sandbox" ? "info" : "neutral"}>{item.environment.toUpperCase()}</Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: BrowserExampleItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/browser-examples/${item.id}/general`}>
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
        title="أمثلة استدعاء المتصفح (Browser Calls & Sandbox Examples)"
        subtitle="نماذج واختبارات حية لاختبار استدعاءات API من متصفح العميل لموديول CRM"
        actionLabel="إضافة نموذج جديد"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث بالاسم أو المسار..."
      />

      <Table columns={columns} data={items} />

      <CreateCrmBrowserExamplesModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCrmBrowserExamplesConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
