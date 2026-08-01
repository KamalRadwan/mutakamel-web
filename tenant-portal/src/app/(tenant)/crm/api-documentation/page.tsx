"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Code2, Server, CheckCircle2 } from "lucide-react";
import { useCrmApiDocs, ApiDocItem } from "./hooks/useCrmApiDocs";
import { CreateCrmApiDocsModal } from "./components/CreateCrmApiDocsModal";
import { DeleteCrmApiDocsConfirmModal } from "./components/DeleteCrmApiDocsConfirmModal";
import { useI18n } from "@/i18n/I18nContext";

export default function CrmApiDocsPage() {
//     const { t } = useI18n();
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
  } = useCrmApiDocs();

  const columns = [
    {
      header: t.crm.aPIAddress,
      cell: (item: ApiDocItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Code2 className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.title}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.methodPath}</p>
          </div>
        </div>
      ),
    },
    {
      header: t.crm.backEndApplication,
      cell: (item: ApiDocItem) => (
        <Badge variant="neutral">{item.owningBackendApp}</Badge>
      ),
    },
    {
      header: t.crm.dTOValidationClass,
      cell: (item: ApiDocItem) => (
        <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{item.dtoValidation}</span>
      ),
    },
    {
      header: t.crm.matchDate,
      cell: (item: ApiDocItem) => (
        <span className="text-xs text-slate-500">{item.verificationDate}</span>
      ),
    },
    {
      header: t.crm.theCondition,
      cell: (item: ApiDocItem) => (
        <Badge variant={item.status === "verified" ? "success" : "warning"}>
          {item.status === "verified" ? t.crm.conformsToSpecifications : t.crm.draft}
        </Badge>
      ),
    },
    {
      header: t.crm.procedures,
      cell: (item: ApiDocItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/api-documentation/${item.id}/general`}>
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
        title={t.crm.cRMAPIDocumentation}
        subtitle={t.crm.recordAPIContractDocuments}
        actionLabel={t.crm.addAPIDocumentation}
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={t.crm.searchByTitlePathOrName}
      />

      <Table columns={columns} data={items} />

      <CreateCrmApiDocsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCrmApiDocsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
