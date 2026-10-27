"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Eye,
  Gavel,
  Layers,
  LayoutGrid,
  RefreshCw,
  ShieldAlert,
  Table2,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  cn,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  EmptyState,
  IdentifierText,
  Input,
  PageHeader,
  PermissionGate,
  SWATCH_SURFACE_PALETTES,
  type ColumnDef,
} from "@/design-system";
import { TenantBranchSelect } from "@/components/tenant/TenantBranchSelect";
import { formatDateTime } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import { InventoryModuleSubnav } from "../components/InventoryModuleSubnav";
import { InventoryListPagination } from "../components/InventoryListPagination";
import { INVENTORY_READ_PERMISSION } from "../inventory-contract";
import {
  INVENTORY_POLICY_KINDS,
  type InventoryDecision,
} from "../inventory-governance-contract";
import { useInventoryDecisions } from "./hooks/useInventoryDecisions";

type ViewMode = "bento" | "table";

function outcomeTone(outcome: string | null): "positive" | "negative" | "caution" | "neutral" {
  if (outcome === "ALLOW") return "positive";
  if (outcome === "BLOCK" || outcome === "DENY") return "negative";
  if (outcome) return "caution";
  return "neutral";
}

function outcomePalette(outcome: string | null) {
  if (outcome === "ALLOW") return SWATCH_SURFACE_PALETTES.green;
  if (outcome === "BLOCK" || outcome === "DENY") return SWATCH_SURFACE_PALETTES.red;
  return SWATCH_SURFACE_PALETTES.amber;
}

export default function InventoryDecisionsPage() {
  const {
    t,
    lang,
    canRead,
    isScopeResolved,
    branchIds,
    branchId,
    selectBranch,
    items,
    pagination,
    setPage,
    policyKind,
    aggregateIdFilter,
    isLoading,
    isRefreshing,
    queryError,
    setPolicyKind,
    setAggregateIdFilter,
    reload,
  } = useInventoryDecisions();

  const isAr = lang === "ar";
  const [viewMode, setViewMode] = useState<ViewMode>("bento");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDecision, setSelectedDecision] = useState<InventoryDecision | null>(null);

  const stats = useMemo(() => {
    const total = items.length;
    const allowed = items.filter((d) => d.outcome === "ALLOW").length;
    const blocked = items.filter((d) => d.outcome && d.outcome !== "ALLOW").length;
    const distinctTypes = new Set(items.map((d) => d.decisionType)).size;
    return { total, allowed, blocked, distinctTypes };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (d) =>
        d.decisionType.toLowerCase().includes(q) ||
        d.aggregateType.toLowerCase().includes(q) ||
        d.aggregateId.toLowerCase().includes(q) ||
        (d.explanationCode ?? "").toLowerCase().includes(q) ||
        (d.explanation ?? "").toLowerCase().includes(q) ||
        (d.correlationId ?? "").toLowerCase().includes(q),
    );
  }, [items, searchQuery]);

  const columns: ColumnDef<InventoryDecision>[] = [
    {
      id: "evaluatedAt",
      header: t.tradeInventory.evaluatedAt,
      cell: (decision) => (
        <div className="flex flex-col gap-0.5">
          <Link
            href={`${TENANT_ROUTES.tradeInventoryDecisions}/${decision.id}`}
            className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {formatDateTime(decision.evaluatedAt, lang)}
          </Link>
          <IdentifierText className="text-2xs text-muted-foreground">
            {decision.id.slice(0, 12)}…
          </IdentifierText>
        </div>
      ),
    },
    {
      id: "decisionType",
      header: t.tradeInventory.decisionType,
      cell: (decision) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-foreground">
            {tradeStatusLabel(
              t.tradeStatus,
              decision.decisionType,
              t.common.unknownCode,
            )}
          </span>
          {decision.explanationCode ? (
            <IdentifierText className="text-2xs text-muted-foreground">
              {decision.explanationCode}
            </IdentifierText>
          ) : null}
        </div>
      ),
    },
    {
      id: "aggregateType",
      header: t.tradeInventory.aggregateType,
      cell: (decision) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-foreground">
            {tradeStatusLabel(
              t.tradeStatus,
              decision.aggregateType,
              t.common.unknownCode,
            )}
          </span>
          <IdentifierText className="text-2xs text-muted-foreground">
            {decision.aggregateId.slice(0, 12)}…
          </IdentifierText>
        </div>
      ),
    },
    {
      id: "outcome",
      header: t.tradeInventory.outcome,
      cell: (decision) =>
        decision.outcome ? (
          <Badge tone={outcomeTone(decision.outcome)}>
            {tradeStatusLabel(
              t.tradeStatus,
              decision.outcome,
              t.common.unknownCode,
            )}
          </Badge>
        ) : (
          "—"
        ),
    },
    {
      id: "actions",
      header: t.common.actions,
      align: "end" as const,
      sticky: "end" as const,
      cell: (decision: InventoryDecision) => (
        <span className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setSelectedDecision(decision)}
          >
            <Eye className="size-3.5" aria-hidden="true" />
            {isAr ? "معاينة" : "Quick View"}
          </Button>
          <Link
            href={`${TENANT_ROUTES.tradeInventoryDecisions}/${decision.id}`}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            <span>{isAr ? "ملف التدقيق" : "Dossier"}</span>
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </span>
      ),
    },
  ];

  const kpiCards = [
    {
      key: "total",
      label: isAr ? "إجمالي تقييمات السياسات" : "Total Policy Evaluations",
      value: String(stats.total),
      sub: isAr ? "سجل حوكمة غير قابل للتعديل" : "Immutable governance audit log",
      icon: Gavel,
      palette: SWATCH_SURFACE_PALETTES.purple,
    },
    {
      key: "allowed",
      label: isAr ? "قرارات مسموحة (ALLOW)" : "Allowed Decisions (ALLOW)",
      value: String(stats.allowed),
      sub: isAr ? "اجتازت فحص السياسات بنجاح" : "Passed policy rules evaluation",
      icon: CheckCircle2,
      palette: SWATCH_SURFACE_PALETTES.green,
    },
    {
      key: "blocked",
      label: isAr ? "قرارات مرفوضة / محظورة" : "Blocked / Guarded Outcomes",
      value: String(stats.blocked),
      sub: isAr ? "تم إيقافها بواسطة قيود الحوكمة" : "Halted by governance guardrails",
      icon: ShieldAlert,
      palette: SWATCH_SURFACE_PALETTES.red,
    },
    {
      key: "domains",
      label: isAr ? "نطاقات السياسات النشطة" : "Evaluated Policy Domains",
      value: String(stats.distinctTypes),
      sub: "PERIOD · UOM · LOT · SERIAL",
      icon: Layers,
      palette: SWATCH_SURFACE_PALETTES.teal,
    },
  ];

  const content = (
    <div className="flex flex-col gap-4">
      <InventoryModuleSubnav active="decisions" />

      <PageHeader
        className="sr-only"
        title={t.tradeInventory.decisionsTitle}
        description={t.tradeInventory.decisionsSubtitle}
        secondaryActions={
          <>
            <TenantBranchSelect
              branchIds={branchIds}
              branchId={branchId}
              onChange={selectBranch}
              disabled={isRefreshing}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void reload()}
              disabled={isRefreshing}
            >
              <RefreshCw
                className={isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.tradeCommon.reload}
            </Button>
          </>
        }
      />

      {isScopeResolved ? (
        <>
          {/* 4-Card Forensic Audit KPI Strip */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.key}
                  className={cn(
                    "flex flex-col justify-between gap-2.5 rounded-lg border border-s-4 p-3.5 transition-all hover:shadow-sm",
                    kpi.palette.sectionCard,
                    kpi.palette.accentBorder,
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-foreground">
                      {kpi.label}
                    </span>
                    <span
                      className={cn(
                        "flex size-8 items-center justify-center rounded-lg",
                        kpi.palette.iconBoxIdle,
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                      {kpi.value}
                    </span>
                    <span className="text-2xs text-muted-foreground">{kpi.sub}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filter & View Switcher Toolbar */}
          <Card className="flex flex-col gap-3 p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-1 flex-wrap items-center gap-2">
                <div className="w-full sm:w-64">
                  <Input
                    size="sm"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={
                      isAr
                        ? "بحث برمز التفسير أو النص أو المرجع..."
                        : "Search explanation code, text, correlation..."
                    }
                  />
                </div>
                <div className="w-full sm:w-64">
                  <Input
                    size="sm"
                    value={aggregateIdFilter}
                    onChange={(e) => setAggregateIdFilter(e.target.value)}
                    placeholder={
                      isAr
                        ? "تصفية بمعرّف الكيان (Aggregate UUID)..."
                        : "Filter by Aggregate UUID (optional)..."
                    }
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted/30 p-1">
                  <Button
                    type="button"
                    size="xs"
                    variant={policyKind === undefined ? "secondary" : "ghost"}
                    onClick={() => setPolicyKind(undefined)}
                  >
                    {isAr ? "الكل" : "All"} ({items.length})
                  </Button>
                  {INVENTORY_POLICY_KINDS.map((kind) => {
                    const active = policyKind === kind;
                    return (
                      <Button
                        key={kind}
                        type="button"
                        size="xs"
                        variant={active ? "secondary" : "ghost"}
                        onClick={() => setPolicyKind(active ? undefined : kind)}
                      >
                        {tradeStatusLabel(
                          t.tradeStatus,
                          kind,
                          t.common.unknownCode,
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
                <Button
                  type="button"
                  size="xs"
                  variant={viewMode === "bento" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("bento")}
                >
                  <LayoutGrid className="size-3.5" aria-hidden="true" />
                  <span>{isAr ? "بطاقات التدقيق" : "Forensic Cards"}</span>
                </Button>
                <Button
                  type="button"
                  size="xs"
                  variant={viewMode === "table" ? "secondary" : "ghost"}
                  onClick={() => setViewMode("table")}
                >
                  <Table2 className="size-3.5" aria-hidden="true" />
                  <span>{isAr ? "الجدول" : "Audit Table"}</span>
                </Button>
              </div>
            </div>
          </Card>

          <InventoryListPagination page={pagination} onPageChange={setPage} isRefreshing={isRefreshing} />

          {viewMode === "bento" ? (
            filteredItems.length === 0 && !isLoading ? (
              <EmptyState
                icon={Gavel}
                title={
                  policyKind || searchQuery || aggregateIdFilter
                    ? t.tradeCommon.emptyForFilter
                    : t.tradeInventory.decisionsEmpty
                }
                description={t.tradeInventory.decisionsSubtitle}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {filteredItems.map((decision) => {
                  const palette = outcomePalette(decision.outcome);
                  return (
                    <Card
                      key={decision.id}
                      className="flex flex-col justify-between gap-3 border border-border/80 p-4 transition-all hover:border-primary/40 hover:shadow-sm"
                    >
                      <div className="flex flex-col gap-3">
                        <div
                          className={cn(
                            "flex items-start justify-between gap-2 rounded-lg border border-s-4 p-3",
                            palette.sectionCard,
                            palette.accentBorder,
                          )}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="text-2xs font-medium text-muted-foreground">
                              {t.tradeInventory.decisionType}
                            </span>
                            <span className="text-xs font-semibold text-foreground">
                              {tradeStatusLabel(
                                t.tradeStatus,
                                decision.decisionType,
                                t.common.unknownCode,
                              )}
                            </span>
                          </div>
                          {decision.outcome ? (
                            <Badge
                              tone={outcomeTone(decision.outcome)}
                            >
                              {tradeStatusLabel(
                                t.tradeStatus,
                                decision.outcome,
                                t.common.unknownCode,
                              )}
                            </Badge>
                          ) : null}
                        </div>

                        {decision.explanationCode || decision.explanation ? (
                          <div className="flex flex-col gap-1 rounded-lg border border-border/60 bg-muted/25 p-2.5 text-xs">
                            {decision.explanationCode ? (
                              <IdentifierText className="font-semibold text-foreground">
                                {decision.explanationCode}
                              </IdentifierText>
                            ) : null}
                            {decision.explanation ? (
                              <p className="line-clamp-2 text-2xs text-muted-foreground">
                                {decision.explanation}
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-2xs text-muted-foreground">
                              {t.tradeInventory.aggregateType}
                            </span>
                            <span className="font-semibold text-foreground">
                              {tradeStatusLabel(
                                t.tradeStatus,
                                decision.aggregateType,
                                t.common.unknownCode,
                              )}
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-2xs text-muted-foreground">
                              {t.tradeInventory.aggregateId}
                            </span>
                            <IdentifierText className="text-2xs font-semibold">
                              {decision.aggregateId.slice(0, 12)}…
                            </IdentifierText>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-2xs text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" aria-hidden="true" />
                            {t.tradeInventory.evaluatedAt}
                          </span>
                          <span className="font-medium text-foreground">
                            {formatDateTime(decision.evaluatedAt, lang)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-2.5">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => setSelectedDecision(decision)}
                        >
                          <Eye className="size-3.5" aria-hidden="true" />
                          {isAr ? "معاينة سريعة" : "Quick View"}
                        </Button>
                        <Link
                          href={`${TENANT_ROUTES.tradeInventoryDecisions}/${decision.id}`}
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent"
                        >
                          <span>
                            {isAr ? "ملف التدقيق 360°" : "360° Forensic Dossier"}
                          </span>
                          <ArrowUpRight className="size-3.5" aria-hidden="true" />
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
          ) : (
            <DataTable
              density="compact"
              columns={columns}
              rows={filteredItems}
              isLoading={isLoading}
              error={queryError}
              onRetry={() => void reload()}
              rowKey={(decision) => decision.id}
              labels={{
                retry: t.common.retry,
                errorTitle: t.tradeInventory.decisionsLoadFailed,
                emptyTitle:
                  policyKind || searchQuery || aggregateIdFilter
                    ? t.tradeCommon.emptyForFilter
                    : t.tradeInventory.decisionsEmpty,
                selectAll: t.common.actions,
                selectRow: t.common.actions,
                sortAscending: t.common.actions,
                sortDescending: t.common.actions,
                notSorted: t.common.actions,
                pagination: {
                  previous: t.common.previousPage,
                  next: t.common.nextPage,
                  summary: (from, to, total) =>
                    formatTemplate(t.common.showingOf, { from, to, total }),
                },
              }}
            />
          )}
        </>
      ) : (
        <EmptyState
          icon={Gavel}
          title={t.tradeInventory.selectCompanyFirst}
          description={t.tradeInventory.selectCompanyFirstDescription}
        />
      )}

      {/* View One: 360° Quick-View Forensic Decision Modal */}
      <Dialog
        open={selectedDecision !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedDecision(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogTitle>{t.tradeInventory.decisionDetailTitle}</DialogTitle>
          <DialogDescription>{t.tradeInventory.decisionProjectionNote}</DialogDescription>
          {selectedDecision ? (
            <div className="mt-3 flex flex-col gap-4">
              <div
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border border-s-4 p-4",
                  outcomePalette(selectedDecision.outcome).sectionCard,
                  outcomePalette(selectedDecision.outcome).accentBorder,
                )}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-2xs text-muted-foreground">
                    {t.tradeInventory.decisionType}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    {tradeStatusLabel(
                      t.tradeStatus,
                      selectedDecision.decisionType,
                      t.common.unknownCode,
                    )}
                  </span>
                </div>
                {selectedDecision.outcome ? (
                  <Badge
                    tone={outcomeTone(selectedDecision.outcome)}
                  >
                    {tradeStatusLabel(
                      t.tradeStatus,
                      selectedDecision.outcome,
                      t.common.unknownCode,
                    )}
                  </Badge>
                ) : null}
              </div>

              {selectedDecision.explanationCode || selectedDecision.explanation ? (
                <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-3.5">
                  <span className="text-2xs font-medium text-muted-foreground">
                    {t.tradeInventory.explanationCode}
                  </span>
                  {selectedDecision.explanationCode ? (
                    <IdentifierText className="text-xs font-semibold text-foreground">
                      {selectedDecision.explanationCode}
                    </IdentifierText>
                  ) : null}
                  {selectedDecision.explanation ? (
                    <p className="text-xs text-muted-foreground">
                      {selectedDecision.explanation}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-2xs text-muted-foreground">
                    {t.tradeInventory.aggregateType}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-foreground">
                    {tradeStatusLabel(
                      t.tradeStatus,
                      selectedDecision.aggregateType,
                      t.common.unknownCode,
                    )}
                  </span>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-2xs text-muted-foreground">
                    {t.tradeInventory.aggregateId}
                  </span>
                  <IdentifierText className="mt-1 block text-xs font-semibold">
                    {selectedDecision.aggregateId}
                  </IdentifierText>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-2xs text-muted-foreground">
                    {t.tradeInventory.evaluatedAt}
                  </span>
                  <span className="mt-1 block text-xs font-semibold text-foreground">
                    {formatDateTime(selectedDecision.evaluatedAt, lang)}
                  </span>
                </div>
                <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                  <span className="text-2xs text-muted-foreground">
                    {t.errors.reference}
                  </span>
                  <IdentifierText className="mt-1 block text-xs font-semibold">
                    {selectedDecision.correlationId ?? "—"}
                  </IdentifierText>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <Link
                  href={`${TENANT_ROUTES.tradeInventoryDecisions}/${selectedDecision.id}`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-2xs transition-colors hover:bg-primary/90"
                >
                  <span>
                    {isAr
                      ? "فتح ملف التدقيق الجنائي 360°"
                      : "Open Full 360° Forensic Dossier"}
                  </span>
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedDecision(null)}
                >
                  {t.common.cancel}
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
