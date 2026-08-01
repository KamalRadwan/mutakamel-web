"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Database, BookOpen, Layers } from "lucide-react";
import { useCrmStaticCatalogue, StaticCatalogueItem } from "./hooks/useCrmStaticCatalogue";
import { CreateCrmStaticCatalogueModal } from "./components/CreateCrmStaticCatalogueModal";
import { DeleteCrmStaticCatalogueConfirmModal } from "./components/DeleteCrmStaticCatalogueConfirmModal";
import { useI18n } from "@/i18n/I18nContext";

export default function CrmStaticCataloguePage() {
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
  } = useCrmStaticCatalogue();

  const columns = [
    {
      header: t.crm.referenceCatalogName,
      cell: (item: StaticCatalogueItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.catalogName}</p>
            <p className="text-[11px] text-slate-400">{t.crm.latestUpdate}{item.lastUpdated}</p>
          </div>
        </div>
      ),
    },
    {
      header: t.crm.classification,
      cell: (item: StaticCatalogueItem) => (
        <Badge variant="info">{item.category.toUpperCase()}</Badge>
      ),
    },
    {
      header: t.crm.numberOfReferenceScraps,
      cell: (item: StaticCatalogueItem) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">{item.entriesCount} {t.crm.component}</span>
      ),
    },
    {
      header: t.crm.theCondition,
      cell: (item: StaticCatalogueItem) => (
        <Badge variant={item.status === "synced" ? "success" : "neutral"}>
          {item.status === "synced" ? t.crm.synchronizedWithCore : t.crm.customizedLocally}
        </Badge>
      ),
    },
    {
      header: t.crm.procedures,
      cell: (item: StaticCatalogueItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/static-data-catalogue/${item.id}/general`}>
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
        title={t.crm.staticDataCatalogAndRefere}
        subtitle={t.crm.managingAndFeedingChecklist}
        actionLabel={t.crm.addANewCatalog}
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={t.crm.searchByCatalogNameOrCate}
      />

      <Table columns={columns} data={items} />

      <CreateCrmStaticCatalogueModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCrmStaticCatalogueConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
