"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Box } from "lucide-react";
import { useTradeCatalogUomChannels, CatalogUomChannelItem } from "./hooks/useTradeCatalogUomChannels";
import { CreateTradeCatalogUomChannelsModal } from "./components/CreateTradeCatalogUomChannelsModal";
import { DeleteTradeCatalogUomChannelsConfirmModal } from "./components/DeleteTradeCatalogUomChannelsConfirmModal";

export default function TradeCatalogUomChannelsPage() {
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
  } = useTradeCatalogUomChannels();

  const columns = [
    {
      header: "الاسم والتعريف",
      cell: (item: CatalogUomChannelItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-50 text-cyan-600 dark:bg-cyan-950/50 dark:text-cyan-400">
            <Box className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] font-mono text-slate-400">{item.code}</p>
          </div>
        </div>
      ),
    },
    {
      header: "النوع",
      cell: (item: CatalogUomChannelItem) => (
        <Badge variant="info">{item.type.toUpperCase()}</Badge>
      ),
    },
    {
      header: "معامل التحويل (Conversion)",
      cell: (item: CatalogUomChannelItem) => (
        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">{item.conversionFactor || "-"}</span>
      ),
    },
    {
      header: "الحالة",
      cell: (item: CatalogUomChannelItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? "مفعل ومستعمل" : "موقف"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: CatalogUomChannelItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/trade/catalog-uom-channels/${item.id}/general`}>
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
        title="الكتالوجات وحدات القياس وقنوات البيع (Catalog, UOM & Channels)"
        subtitle="تعريف وحدات التعبئة، معامل التحويل، وقنوات توزيع المنتجات التجارية"
        actionLabel="إضافة وحدة / كتالوج"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث بالاسم، الكود، أو النوع..."
      />

      <Table columns={columns} data={items} />

      <CreateTradeCatalogUomChannelsModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteTradeCatalogUomChannelsConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
