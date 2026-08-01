"use client";

import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { Table } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Eye, Trash2, Building2, UserCheck, DollarSign } from "lucide-react";
import { useCustomerProfiles, CustomerProfileItem } from "./hooks/useCustomerProfiles";
import { CreateCustomerProfilesModal } from "./components/CreateCustomerProfilesModal";
import { DeleteCustomerProfilesConfirmModal } from "./components/DeleteCustomerProfilesConfirmModal";
import { useI18n } from "@/i18n/I18nContext";

export default function CustomerProfilesPage() {
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
  } = useCustomerProfiles();

  const columns = [
    {
      header: t.crm.clientCompanyName,
      cell: (item: CustomerProfileItem) => (
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
            <p className="text-[11px] text-slate-400">{item.contactPerson} · {item.phone}</p>
          </div>
        </div>
      ),
    },
    {
      header: t.crm.classification,
      cell: (item: CustomerProfileItem) => (
        <Badge variant={item.category === "VIP" ? "warning" : item.category === "Enterprise" ? "info" : "neutral"}>
          {item.category}
        </Badge>
      ),
    },
    {
      header: t.crm.totalValueOfTransactions,
      cell: (item: CustomerProfileItem) => (
        <span className="font-bold text-emerald-600">{item.totalDealsValue}</span>
      ),
    },
    {
      header: t.crm.theCondition,
      cell: (item: CustomerProfileItem) => (
        <Badge variant={item.status === "active" ? "success" : "neutral"}>
          {item.status === "active" ? t.crm.activeClient : t.crm.inactive}
        </Badge>
      ),
    },
    {
      header: t.crm.procedures,
      cell: (item: CustomerProfileItem) => (
        <div className="flex items-center gap-1.5">
          <Link href={`/crm/customer-profiles/${item.id}/general`}>
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
        title={t.crm.customerProfilesAndCards}
        subtitle={t.crm.aComprehensive360DegreeRec}
        actionLabel={t.crm.addANewClient}
        onAction={() => setIsCreateOpen(true)}
      />

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={t.crm.searchByCompanyNameOffici}
      />

      <Table columns={columns} data={items} />

      <CreateCustomerProfilesModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <DeleteCustomerProfilesConfirmModal
        isOpen={!!selectedForDelete}
        item={selectedForDelete}
        onClose={() => setSelectedForDelete(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
