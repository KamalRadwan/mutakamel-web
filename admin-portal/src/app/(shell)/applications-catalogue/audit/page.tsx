"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { applicationsApi } from "@/features/admin/applications/api/applications.api";
import type {
  CatalogueAuditEntityType,
  CatalogueAuditEventView,
  CatalogueAuditPageView,
} from "@/features/admin/applications/types";
import { useI18n } from "@/i18n/I18nContext";
import { adminCanAll } from "@/lib/auth/rbac";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import {
  PageHeader,
  FilterBar,
  DataTable,
  Button,
  Card,
  CardContent,
  ErrorState,
  type ColumnDef,
} from "@/design-system";

const ENTITY_TYPES = [
  "APPLICATION",
  "TIER",
  "FEATURE",
  "TIER_FEATURE_GRANTS",
  "PRICE_LADDER",
] as const satisfies readonly CatalogueAuditEntityType[];

export default function CatalogueAuditPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { lang, dir } = useI18n();
  const text = auditCopy(lang);
  const canRead = adminCanAll(user, ["admin.catalog.read"]);
  const [data, setData] = useState<CatalogueAuditPageView | null>(null);
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] =
    useState<CatalogueAuditEntityType | "ALL">("ALL");
  const [action, setAction] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const load = useCallback(async () => {
    if (isAuthLoading || !canRead) return;
    setIsLoading(true);
    setError(null);
    try {
      setData(
        await applicationsApi.getGlobalAudit({
          page,
          limit: 20,
          ...(entityType !== "ALL" ? { entityType } : {}),
          ...(action.trim() ? { action: action.trim() } : {}),
        }),
      );
    } catch (requestError) {
      setData(null);
      setError(normalizeApiError(requestError));
    } finally {
      setIsLoading(false);
    }
  }, [action, canRead, entityType, isAuthLoading, page]);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const columns: ColumnDef<CatalogueAuditEventView>[] = [
    {
      key: "action",
      headerEn: "Action",
      headerAr: "الإجراء",
      cell: (event) => <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-400">{event.action}</span>,
    },
    {
      key: "entityType",
      headerEn: "Entity",
      headerAr: "الكيان",
      cell: (event) => (
        <span className="rounded-full bg-muted px-2 py-1 text-xs font-semibold text-foreground">
          {text.entityNames[event.entityType] ?? event.entityType}
        </span>
      ),
    },
    {
      key: "occurredAt",
      headerEn: "Occurred At",
      headerAr: "وقت الحدوث",
      cell: (event) => new Date(event.occurredAt).toLocaleString(lang === "ar" ? "ar-EG" : "en-US"),
    },
    {
      key: "actor",
      headerEn: "Actor",
      headerAr: "المنفذ",
      cell: (event) => event.actorLabel || event.actorAdminId || text.system,
    },
    {
      key: "correlationId",
      headerEn: "Correlation",
      headerAr: "معرّف الارتباط",
      cell: (event) => <span className="font-mono text-xs text-muted-foreground">{event.correlationId || text.notProvided}</span>,
    },
  ];

  return (
    <div dir={dir} className="w-full space-y-6">
      <PageHeader
        breadcrumb={
          <Button variant="link" size="sm" asChild className="w-fit px-0">
            <Link href="/applications-catalogue">
              <ArrowLeft className={`size-4 ${dir === "rtl" ? "rotate-180" : ""}`} />
              {text.back}
            </Link>
          </Button>
        }
        title={text.title}
        action={
          canRead && (
            <Button type="button" variant="outline" size="sm" onClick={() => void load()} disabled={isLoading}>
              <RefreshCw className={`size-4 ${isLoading ? "animate-spin" : ""}`} />
              {text.refresh}
            </Button>
          )
        }
      />

      {isAuthLoading ? (
        <StateCard loading>{text.checking}</StateCard>
      ) : !canRead ? (
        <StateCard>{text.forbidden}</StateCard>
      ) : (
        <div className="space-y-0 rounded-lg border border-border bg-card">
          <FilterBar
            fields={[
              {
                key: "entityType",
                type: "select",
                placeholderEn: text.entityType,
                placeholderAr: text.entityType,
                options: [
                  { value: "ALL", labelEn: text.allEntityTypes, labelAr: text.allEntityTypes },
                  ...ENTITY_TYPES.map((value) => ({ value, labelEn: text.entityNames[value], labelAr: text.entityNames[value] })),
                ],
              },
              { key: "action", type: "search", placeholderEn: text.actionPlaceholder, placeholderAr: text.actionPlaceholder },
            ]}
            values={{ entityType: entityType === "ALL" ? "" : entityType, action }}
            onChange={(next) => {
              setEntityType(((typeof next.entityType === "string" && next.entityType) || "ALL") as CatalogueAuditEntityType | "ALL");
              setAction(typeof next.action === "string" ? next.action : "");
              setPage(1);
            }}
          />
          {error ? (
            <ErrorState error={error} title={text.unavailable} onRetry={() => void load()} />
          ) : (
            <DataTable
              columns={columns}
              data={data?.items ?? []}
              isLoading={isLoading}
              getRowId={(event) => event.id}
              pagination={{ page, limit: data?.limit ?? 20, totalItems: data?.total ?? 0, totalPages: data?.totalPages ?? 0, onPageChange: setPage }}
              emptyState={{ titleEn: text.empty, titleAr: text.empty }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function StateCard({ children, loading = false }: { children: React.ReactNode; loading?: boolean }) {
  return (
    <Card>
      <CardContent role={loading ? "status" : "alert"} className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        {loading ? <RefreshCw className="size-4 animate-spin" /> : null}
        {children}
      </CardContent>
    </Card>
  );
}

function auditCopy(lang: "ar" | "en") {
  return lang === "ar"
    ? {
        back: "العودة إلى كتالوج التطبيقات",
        title: "تدقيق الكتالوج",
        checking: "جارٍ التحقق من صلاحية قراءة الكتالوج…",
        forbidden: "تلزم صلاحية قراءة الكتالوج لعرض سجل التدقيق.",
        entityType: "نوع الكيان",
        allEntityTypes: "كل أنواع الكيانات",
        actionPlaceholder: "صفِّ حسب اسم الإجراء الدقيق",
        refresh: "تحديث",
        unavailable: "تعذر تحميل سجل تدقيق الكتالوج.",
        empty: "لا توجد أحداث تدقيق مطابقة.",
        system: "النظام",
        notProvided: "غير متوفر",
        entityNames: {
          MODULE: "وحدة",
          MODULE_ORDER: "ترتيب الوحدات",
          APPLICATION: "تطبيق",
          TIER: "باقة",
          FEATURE: "ميزة",
          TIER_FEATURE_GRANTS: "منح ميزات الباقة",
          PRICE_LADDER: "سلم الأسعار",
          TIER_STORAGE_ENTITLEMENT: "استحقاق تخزين الباقة",
        } as Record<CatalogueAuditEntityType, string>,
      }
    : {
        back: "Back to Application Catalogue",
        title: "Catalogue audit",
        checking: "Checking catalogue-read permission…",
        forbidden: "Catalogue-read permission is required to view audit history.",
        entityType: "Entity type",
        allEntityTypes: "All entity types",
        actionPlaceholder: "Filter by exact action",
        refresh: "Refresh",
        unavailable: "Catalogue audit is unavailable.",
        empty: "No matching catalogue audit events.",
        system: "System",
        notProvided: "not provided",
        entityNames: {
          MODULE: "Module",
          MODULE_ORDER: "Module order",
          APPLICATION: "Application",
          TIER: "Tier",
          FEATURE: "Feature",
          TIER_FEATURE_GRANTS: "Tier feature grants",
          PRICE_LADDER: "Price ladder",
          TIER_STORAGE_ENTITLEMENT: "Tier storage entitlement",
        } as Record<CatalogueAuditEntityType, string>,
      };
}
