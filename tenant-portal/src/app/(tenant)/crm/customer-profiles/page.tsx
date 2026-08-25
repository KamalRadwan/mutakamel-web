"use client";

import Link from "next/link";
import { Building2, Eye, RefreshCw, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import {
  type CustomerProfileItem,
  type CustomerProfileStatus,
  type CustomerProfileType,
  useCustomerProfiles,
} from "./hooks/useCustomerProfiles";

function statusVariant(
  status: CustomerProfileStatus,
): "success" | "warning" | "danger" | "neutral" {
  if (status === "ACTIVE_CUSTOMER") return "success";
  if (status === "PROSPECT") return "warning";
  if (status === "BLACKLISTED") return "danger";
  return "neutral";
}

export default function CustomerProfilesPage() {
  const {
    t,
    lang,
    items,
    branchIds,
    branchId,
    selectBranch,
    pagination,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    previousPage,
    nextPage,
    reload,
  } = useCustomerProfiles();

  const copy =
    lang === "ar"
      ? {
          subtitle: "ملفات العملاء الحالية من CRM للفرع الموثوق في الجلسة.",
          reload: "إعادة التحميل",
          search: "ابحث بالاسم أو بيانات التواصل...",
          name: "اسم العميل",
          type: "النوع",
          contact: "التواصل",
          status: "الحالة",
          actions: "الإجراءات",
          loading: "جارٍ تحميل ملفات العملاء...",
          empty: "لا توجد ملفات عملاء مطابقة.",
          unavailable: "غير متوفر",
          view: "عرض",
          previous: "السابق",
          next: "التالي",
          records: "ملف",
          page: "صفحة",
        }
      : {
          subtitle: "Current CRM customer profiles for the trusted session branch.",
          reload: "Reload",
          search: "Search by name or contact details...",
          name: "Customer name",
          type: "Type",
          contact: "Contact",
          status: "Status",
          actions: "Actions",
          loading: "Loading customer profiles...",
          empty: "No matching customer profiles.",
          unavailable: "Not available",
          view: "View",
          previous: "Previous",
          next: "Next",
          records: "profiles",
          page: "Page",
        };

  const typeLabels: Record<CustomerProfileType, string> =
    lang === "ar"
      ? { INDIVIDUAL: "فرد", CORPORATE: "شركة" }
      : { INDIVIDUAL: "Individual", CORPORATE: "Corporate" };
  const statusLabels: Record<CustomerProfileStatus, string> =
    lang === "ar"
      ? {
          PROSPECT: "محتمل",
          ACTIVE_CUSTOMER: "نشط",
          INACTIVE: "غير نشط",
          BLACKLISTED: "محظور",
        }
      : {
          PROSPECT: "Prospect",
          ACTIVE_CUSTOMER: "Active customer",
          INACTIVE: "Inactive",
          BLACKLISTED: "Blacklisted",
        };

  const columns = [
    {
      header: copy.name,
      cell: (item: CustomerProfileItem) => {
        const ProfileIcon =
          item.profileType === "CORPORATE" ? Building2 : UserRound;
        return (
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <ProfileIcon className="size-4" aria-hidden="true" />
            </div>
            <div>
              <p className="font-bold text-slate-900 dark:text-slate-100">
                {item.displayName}
              </p>
              {item.companyName && item.companyName !== item.displayName && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {item.companyName}
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      header: copy.type,
      cell: (item: CustomerProfileItem) => (
        <Badge variant="info">{typeLabels[item.profileType]}</Badge>
      ),
    },
    {
      header: copy.contact,
      cell: (item: CustomerProfileItem) => (
        <div className="space-y-0.5" dir="ltr">
          <p>{item.email ?? copy.unavailable}</p>
          {item.phone && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {item.phone}
            </p>
          )}
        </div>
      ),
    },
    {
      header: copy.status,
      cell: (item: CustomerProfileItem) => (
        <Badge variant={statusVariant(item.status)}>
          {statusLabels[item.status]}
        </Badge>
      ),
    },
    {
      header: copy.actions,
      cell: (item: CustomerProfileItem) => (
        <Link
          href={"/crm/customer-profiles/" + encodeURIComponent(item.id)}
          aria-label={copy.view + " " + item.displayName}
          className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <Eye className="size-4" aria-hidden="true" />
          {copy.view}
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.crm.customerProfilesAndCards}
        subtitle={copy.subtitle}
      >
        <div className="flex flex-wrap items-center gap-2">
          <TenantBranchSelect
            branchIds={branchIds}
            branchId={branchId}
            onChange={selectBranch}
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={reload}
            disabled={isLoading}
          >
            <RefreshCw
              className={"size-4 " + (isLoading ? "animate-spin" : "")}
              aria-hidden="true"
            />
            {copy.reload}
          </Button>
        </div>
      </PageHeader>

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={copy.search}
      />

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      {isLoading ? (
        <p
          role="status"
          className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-900"
        >
          {copy.loading}
        </p>
      ) : error ? null : (
        <Table columns={columns} data={items} emptyText={copy.empty} />
      )}

      {!isLoading && !error && pagination && (
        <nav
          aria-label={lang === "ar" ? "ترقيم صفحات العملاء" : "Customer profile pagination"}
          className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {pagination.total} {copy.records} · {copy.page} {pagination.page}
            {pagination.totalPages > 0 ? " / " + pagination.totalPages : ""}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={previousPage}
              disabled={!pagination.hasPrev}
            >
              {copy.previous}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={nextPage}
              disabled={!pagination.hasNext}
            >
              {copy.next}
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
