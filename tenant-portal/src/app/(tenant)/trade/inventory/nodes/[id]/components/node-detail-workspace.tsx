"use client";

import Link from "next/link";
import {
  Boxes,
  CheckCircle2,
  Clock,
  GitBranch,
  Pencil,
  Warehouse,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  cn,
  ConflictDialog,
  DetailHeader,
  DetailSection,
  ErrorState,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  Skeleton,
  SWATCH_SURFACE_PALETTES,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../../../trade-advanced-validation";
import { InventoryModuleSubnav } from "../../../components/InventoryModuleSubnav";
import { INVENTORY_READ_PERMISSION } from "../../../inventory-contract";
import { useInventoryNode } from "../hooks/useInventoryNode";
import { EditNodeModal } from "./EditNodeModal";

export function NodeDetailWorkspace({ nodeId }: { nodeId: string }) {
  const { t } = useI18n();
  const {
    lang,
    canRead,
    canManage,
    node,
    isLoading,
    queryError,
    isNotFound,
    isSubmitting,
    formError,
    editOpen,
    conflictOpen,
    openEdit,
    closeEdit,
    resolveConflict,
    dismissConflict,
    update,
    reload,
  } = useInventoryNode(nodeId);

  const inv = t.tradeInventory;
  const activeBranches =
    node?.branches.filter((b) => b.isActive).length ?? 0;

  const content = (
    <div className="flex flex-col gap-3.5">
      <InventoryModuleSubnav
        active="nodes"
        scopeBadge={`READ: BRANCH • WRITE: COMPANY`}
      />

      <DetailHeader
        title={node?.code ?? inv.nodeDetailTitle}
        subtitle={node?.name}
        status={
          node ? (
            <Badge tone={node.status === "ACTIVE" ? "positive" : "neutral"}>
              {tradeStatusLabel(t.tradeStatus, node.status, t.common.unknownCode)}
            </Badge>
          ) : undefined
        }
        backLabel={inv.backToNodes}
        backHref={TENANT_ROUTES.tradeInventoryNodes}
        secondaryActions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href="/trade/inventory">
                <Boxes className="size-4" aria-hidden="true" />
                {inv.availabilityTitle}
              </Link>
            </Button>
            {canManage && node ? (
              <Button size="sm" onClick={openEdit}>
                <Pencil className="size-4" aria-hidden="true" />
                {inv.nodeEditTitle}
              </Button>
            ) : null}
          </div>
        }
      />

      {isNotFound ? (
        <NotFoundState
          title={inv.nodeNotFound}
          description={inv.nodeNotFoundDescription}
          backLabel={inv.backToNodes}
          backHref={TENANT_ROUTES.tradeInventoryNodes}
        />
      ) : isLoading ? (
        <Skeleton className="h-64" />
      ) : queryError ? (
        <ErrorState
          title={inv.nodeLoadFailed}
          description={queryError.message}
          onRetry={() => void reload()}
          retryLabel={t.common.retry}
        />
      ) : node ? (
        <>
          {/* 4-Card Node Dossier KPI Strip */}
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <div
              className={cn(
                "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.indigo.sectionCard,
                SWATCH_SURFACE_PALETTES.indigo.accentBorder,
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                    SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle,
                  )}
                >
                  <Warehouse className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {inv.nodeType}
                  </span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {node.code}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-foreground">
                {tradeStatusLabel(
                  t.tradeStatus,
                  node.nodeType,
                  t.common.unknownCode,
                )}
              </span>
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.green.sectionCard,
                SWATCH_SURFACE_PALETTES.green.accentBorder,
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                    SWATCH_SURFACE_PALETTES.green.iconBoxIdle,
                  )}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {t.common.status}
                  </span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {formatDateTime(node.updatedAt, lang)}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-xs font-semibold text-foreground">
                {tradeStatusLabel(
                  t.tradeStatus,
                  node.status,
                  t.common.unknownCode,
                )}
              </span>
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.teal.sectionCard,
                SWATCH_SURFACE_PALETTES.teal.accentBorder,
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                    SWATCH_SURFACE_PALETTES.teal.iconBoxIdle,
                  )}
                >
                  <GitBranch className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {inv.nodeBranches}
                  </span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {inv.nodeBranchesDetailHint}
                  </span>
                </div>
              </div>
              <span className="shrink-0 font-mono text-base font-semibold text-foreground">
                {`${formatNumber(activeBranches, lang)}/${formatNumber(node.branches.length, lang)}`}
              </span>
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-2.5 rounded-lg border border-s-4 px-3.5 py-2.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.purple.sectionCard,
                SWATCH_SURFACE_PALETTES.purple.accentBorder,
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                    SWATCH_SURFACE_PALETTES.purple.iconBoxIdle,
                  )}
                >
                  <Clock className="size-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {inv.nodeTimezone}
                  </span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {t.tradeCommon.version}
                  </span>
                </div>
              </div>
              <span className="shrink-0 font-mono text-xs font-semibold text-foreground">
                {node.timezone} • v{formatNumber(node.version, lang)}
              </span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DetailSection
              title={t.tradeCommon.overview}
              emptyValueLabel={t.tradeCommon.notSet}
              fields={[
                {
                  label: inv.nodeType,
                  value: tradeStatusLabel(
                    t.tradeStatus,
                    node.nodeType,
                    t.common.unknownCode,
                  ),
                },
                { label: inv.nodeTimezone, value: node.timezone },
                { label: t.tradeCommon.version, value: String(node.version) },
                {
                  label: t.tradeCommon.updatedAt,
                  value: formatDateTime(node.updatedAt, lang),
                },
              ]}
            />

            <Card className="flex flex-col gap-3 border-border p-4 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {inv.nodeBranches}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {inv.nodeBranchesDetailHint}
                  </p>
                </div>
                <Badge tone="brand">
                  {formatNumber(node.branches.length, lang)}
                </Badge>
              </div>
              <div className="flex flex-col gap-2">
                {node.branches.map((branch) => (
                  <div
                    key={branch.branchId}
                    className={cn(
                      "flex items-center justify-between rounded-lg border border-s-4 px-3 py-2",
                      branch.isActive
                        ? SWATCH_SURFACE_PALETTES.green.sectionCard
                        : "border-border bg-muted/30",
                      branch.isActive
                        ? SWATCH_SURFACE_PALETTES.green.accentBorder
                        : "border-s-border",
                    )}
                  >
                    <IdentifierText className="text-xs font-semibold">
                      {branch.branchId}
                    </IdentifierText>
                    <Badge tone={branch.isActive ? "positive" : "neutral"}>
                      {branch.isActive ? t.common.active : t.common.inactive}
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {node && editOpen ? (
        <EditNodeModal
          key={node.version}
          node={node}
          isOpen={editOpen}
          onClose={closeEdit}
          onSubmit={update}
          isSubmitting={isSubmitting}
          error={formError}
        />
      ) : null}

      <ConflictDialog
        open={conflictOpen}
        onOpenChange={(open) => {
          if (!open) dismissConflict();
        }}
        title={t.tradeCommon.conflictTitle}
        description={t.tradeCommon.conflictDescription}
        onReload={resolveConflict}
        onCancel={dismissConflict}
        loading={isSubmitting}
        labels={{
          yourChanges: t.tradeCommon.yourChanges,
          theirChanges: t.tradeCommon.theirChanges,
          reload: t.tradeCommon.conflictReload,
          overwrite: t.tradeCommon.conflictOverwrite,
          cancel: t.common.cancel,
        }}
      />
    </div>
  );

  return canRead ? (
    content
  ) : (
    <PermissionGate require={INVENTORY_READ_PERMISSION}>{content}</PermissionGate>
  );
}
