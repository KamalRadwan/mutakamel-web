"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, FileCheck, ShieldCheck, Braces } from "lucide-react";
import { useCommonBrowserContract, BrowserContractRuleItem } from "./hooks/useCommonBrowserContract";
import { CreateCommonBrowserContractModal } from "./components/CreateCommonBrowserContractModal";
import { DeleteCommonBrowserContractConfirmModal } from "./components/DeleteCommonBrowserContractConfirmModal";
import { useI18n } from "@/i18n/I18nContext";

export default function CommonBrowserContractPage() {
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
  } = useCommonBrowserContract();

  const columns = [
    {
      header: t.crm.nameOfTheNodalRule,
      cell: (item: BrowserContractRuleItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-sky-50 text-sky-600 dark:bg-sky-950/50 dark:text-sky-400">
            <Braces className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.ruleName}</p>
            <p className="text-[11px] font-mono text-slate-400 truncate max-w-xs">{item.envelopeStructure}</p>
          </div>
        </div>
      ),
    },
    {
      header: t.crm.errorClassification,
      cell: (item: BrowserContractRuleItem) => (
        <Badge variant="neutral">{item.errorCategory}</Badge>
      ),
    },
    {
      header: t.crm.hTTPResponseCode,
      cell: (item: BrowserContractRuleItem) => (
        <Badge variant={item.statusCode === 200 ? "success" : "warning"}>{item.statusCode}</Badge>
      ),
    },
    {
      header: t.crm.theCondition,
      cell: (item: BrowserContractRuleItem) => (
        <Badge variant="success">{t.crm.enabledAndMandatory}</Badge>
      ),
    },
    {
      header: t.crm.procedures,
      cell: (item: BrowserContractRuleItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/common-browser-contract/${item.id}/general`}>
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
        title={t.crm.commonBrowserContract}
        subtitle={t.crm.documentingTheUnifiedStruct}
        actionLabel={t.crm.defineANewRule}
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={t.crm.searchByNameOfBaseOrStru}
      />

      <Table columns={columns} data={items} />

      <CreateCommonBrowserContractModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCommonBrowserContractConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
