"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { TableToolbar } from "@/components/ui/TableToolbar";
import { BookOpen, RefreshCw } from "lucide-react";
import {
  type StaticCatalogueGroup,
  type StaticCatalogueGroupKind,
  useCrmStaticCatalogue,
} from "./hooks/useCrmStaticCatalogue";

const KIND_VARIANTS: Record<
  StaticCatalogueGroupKind,
  "info" | "neutral" | "success" | "warning"
> = {
  enum: "info",
  permission: "warning",
  owner: "neutral",
  event: "success",
  attachment: "neutral",
  rule: "warning",
};

export default function CrmStaticCataloguePage() {
  const {
    t,
    lang,
    catalogue,
    groups,
    searchQuery,
    setSearchQuery,
    isLoading,
    error,
    reload,
  } = useCrmStaticCatalogue();

  const copy =
    lang === "ar"
      ? {
          subtitle:
            "مرجع للأنواع والتسميات والصلاحيات التي يعيدها CRM حاليًا. هذه البيانات للقراءة فقط.",
          reload: "إعادة التحميل",
          search: "ابحث باسم المجموعة أو بقيمة...",
          group: "مجموعة العقد",
          kind: "النوع",
          entries: "العناصر",
          examples: "قيم حالية",
          loading: "جارٍ تحميل مرجع CRM...",
          empty: "لا توجد مجموعات مطابقة.",
          advertisedPolicy:
            "سياسة المرفقات هنا وصفية فقط؛ مسار الرفع وقواعد التخزين هما المرجع الأمني النهائي.",
        }
      : {
          subtitle:
            "Current CRM enum, label, and permission vocabulary. This catalogue is read-only.",
          reload: "Reload",
          search: "Search groups or values...",
          group: "Contract group",
          kind: "Type",
          entries: "Entries",
          examples: "Current values",
          loading: "Loading the CRM catalogue...",
          empty: "No matching catalogue groups.",
          advertisedPolicy:
            "The attachment policy shown here is descriptive; the upload route and storage allowlist remain authoritative.",
        };

  const columns = [
    {
      header: copy.group,
      cell: (item: StaticCatalogueGroup) => (
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <BookOpen className="h-4 w-4" aria-hidden="true" />
          </div>
          <code className="font-semibold text-slate-900 dark:text-slate-100">
            {item.key}
          </code>
        </div>
      ),
    },
    {
      header: copy.kind,
      cell: (item: StaticCatalogueGroup) => (
        <Badge variant={KIND_VARIANTS[item.kind]}>{item.kind}</Badge>
      ),
    },
    {
      header: copy.entries,
      cell: (item: StaticCatalogueGroup) => (
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {item.entriesCount}
        </span>
      ),
    },
    {
      header: copy.examples,
      cell: (item: StaticCatalogueGroup) => (
        <span
          className="block max-w-xl truncate text-slate-600 dark:text-slate-300"
          title={item.values.join(" · ")}
        >
          {item.values.slice(0, 3).join(" · ") || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.crm.staticDataCatalogAndRefere}
        subtitle={copy.subtitle}
      >
        <Button
          type="button"
          variant="secondary"
          onClick={() => void reload()}
          disabled={isLoading}
        >
          <RefreshCw
            className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          {copy.reload}
        </Button>
      </PageHeader>

      <TableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={copy.search}
      />

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      ) : isLoading && !catalogue ? (
        <div
          role="status"
          className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400"
        >
          {copy.loading}
        </div>
      ) : (
        <Table columns={columns} data={groups} emptyText={copy.empty} />
      )}

      {catalogue && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          {copy.advertisedPolicy}
        </p>
      )}
    </div>
  );
}
