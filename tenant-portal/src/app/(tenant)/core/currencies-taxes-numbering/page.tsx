"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2 } from "lucide-react";
import { useCurrenciesTaxesNumbering, CurrencyItem } from "./hooks/useCurrenciesTaxesNumbering";
import { CreateCurrenciesTaxesNumberingModal } from "./components/CreateCurrenciesTaxesNumberingModal";
import { DeleteCurrenciesTaxesNumberingConfirmModal } from "./components/DeleteCurrenciesTaxesNumberingConfirmModal";

export default function CurrenciesTaxesNumberingPage() {
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
  } = useCurrenciesTaxesNumbering();

  const columns = [
    {
      header: "العملة",
      cell: (item: CurrencyItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400 font-bold">
            {item.symbol}
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] text-slate-400">{item.code}</p>
          </div>
        </div>
      ),
    },
    { header: "سعر الصرف المعياري", accessorKey: "exchangeRate" as keyof CurrencyItem },
    {
      header: "العملة الافتراضية",
      cell: (item: CurrencyItem) => (
        <Badge variant={item.isDefault ? "success" : "neutral"}>
          {item.isDefault ? "افتراضية" : "فرعية"}
        </Badge>
      ),
    },
    {
      header: "الإجراءات",
      cell: (item: CurrencyItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/core/currencies-taxes-numbering/${item.id}/general`}>
            <Button variant="ghost" size="sm">
              <Eye className="w-4 h-4" />
            </Button>
          </Link>
          {!item.isDefault && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedForDelete(item)}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="العملات، الضرائب، وتسلسل الترقيم (Currencies, Taxes & Numbering)"
        subtitle="ضبط العملات المتعددة، قواعد الضرائب (VAT/ZATCA)، وتسلسل الترقيم التلقائي للفواتير والطلب"
        actionLabel="إضافة عملة جديدة"
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="ابحث باسم العملة أو الرمز..."
      />

      <Table columns={columns} data={items} />

      <CreateCurrenciesTaxesNumberingModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCurrenciesTaxesNumberingConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
