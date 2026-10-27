"use client";

import { useState } from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  Eye,
  FolderPlus,
  FolderTree,
  GitBranch,
  Globe,
  Layers,
  MoveRight,
  Package,
  Pencil,
  Power,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import {
  Badge,
  Button,
  cn,
  DetailSection,
  ErrorState,
  FormModal,
  IdentifierText,
  NotFoundState,
  PermissionGate,
  Skeleton,
  SWATCH_SURFACE_PALETTES,
} from "@/design-system";
import { formatDateTime } from "@/lib/format/date";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import {
  getCategoryDepthHue,
  getCategoryDomainMetadata,
} from "../category-catalogue-metadata";
import type { CategoryDetail } from "../category-contract";
import type { useCategoryWorkspace } from "../hooks/useCategoryWorkspace";

export function CategoryDetailPanel({
  workspace: state,
  modalOpen: controlledModalOpen,
  onModalOpenChange,
}: {
  workspace: ReturnType<typeof useCategoryWorkspace>;
  modalOpen?: boolean;
  onModalOpenChange?: (open: boolean) => void;
}) {
  const { t, lang, detail } = state;
  const copy = t.trade.categories;
  const node = detail.data;
  const [internalModalOpen, setInternalModalOpen] = useState(false);
  const isModalOpen = controlledModalOpen ?? internalModalOpen;
  const setModalOpen = onModalOpenChange ?? setInternalModalOpen;

  if (state.invalidId || detail.error?.status === 404) {
    return (
      <NotFoundState
        title={copy.missing}
        backLabel={copy.back}
        onBack={() => state.select(null)}
      />
    );
  }
  if (detail.loading) return <Skeleton className="h-64 w-full" />;
  if (detail.error) {
    return (
      <PermissionGate
        require={TRADE_PERMISSIONS.itemsRead}
        denied={detail.error.status === 403}
      >
        <ErrorState
          title={copy.loadFailed}
          retryLabel={t.common.retry}
          onRetry={() => void detail.reload()}
        />
      </PermissionGate>
    );
  }
  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card p-8 text-center">
        <FolderTree
          className="size-8 text-muted-foreground/60"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-muted-foreground">
          {copy.selectDetail}
        </p>
      </div>
    );
  }

  const meta = getCategoryDomainMetadata(
    node.code,
    node.displayName,
    node.depth,
  );
  const palette = SWATCH_SURFACE_PALETTES[meta.hue];
  const depthPalette = SWATCH_SURFACE_PALETTES[meta.depthHue];
  const currentSegment = node.path.at(-1);

  return (
    <>
      <section
        className="min-w-0 space-y-4 rounded-lg border border-border bg-card p-4 shadow-2xs"
        aria-label={node.name}
      >
        {/* Colorful Category Header Card */}
        <div
          className={cn(
            "flex flex-col gap-3 rounded-lg border border-s-4 p-3.5",
            palette.sectionCard,
            palette.accentBorder,
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <IdentifierText className="rounded-md border border-border bg-card px-2 py-0.5 text-xs font-semibold text-foreground">
                {node.code}
              </IdentifierText>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-2xs font-medium",
                  palette.badge,
                )}
              >
                <span
                  className={cn("size-1.5 rounded-full", palette.dot)}
                  aria-hidden="true"
                />
                {copy[`domain_${meta.domain}`]}
              </span>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium",
                  depthPalette.badge,
                )}
              >
                {formatTemplate(copy.levelBadge, {
                  depth: formatNumber(node.depth, lang),
                })}
              </span>
              {currentSegment ? (
                <span className="rounded-full border border-border bg-card px-2 py-0.5 text-2xs font-medium text-muted-foreground">
                  {formatTemplate(copy.siblingPositionLabel, {
                    pos: formatNumber(currentSegment.siblingPosition, lang),
                    total: formatNumber(currentSegment.siblingTotal, lang),
                  })}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              <Badge tone={node.effectiveActive ? "positive" : "neutral"}>
                {node.status === "ACTIVE"
                  ? copy.status.ACTIVE
                  : node.status === "INACTIVE"
                    ? copy.status.INACTIVE
                    : copy.status.unknown}
              </Badge>
              <Button
                type="button"
                variant="outline"
                size="xs"
                className="gap-1 bg-card"
                onClick={() => setModalOpen(true)}
              >
                <Eye className="size-3.5" aria-hidden="true" />
                {copy.openModalView}
              </Button>
            </div>
          </div>

          <div className="min-w-0">
            <h2 className="break-words text-lg font-semibold text-foreground">
              {node.name}
            </h2>
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {node.path.map((entry) => entry.name).join(" / ")}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 bg-card"
              onClick={() => void state.reveal()}
            >
              <FolderTree className="size-3.5" aria-hidden="true" />
              {copy.showInTree}
            </Button>
          </div>
        </div>

        {/* Inherited Inactive Alert Banner */}
        {node.status === "ACTIVE" && !node.effectiveActive ? (
          <div
            role="status"
            className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning-subtle/50 p-3 text-xs text-foreground"
          >
            <ShieldAlert
              className="mt-0.5 size-4 shrink-0 text-warning-subtle-foreground"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="font-semibold">{copy.inheritedInactive}</p>
            </div>
          </div>
        ) : null}

        {/* 3-Card Usage Metrics Strip */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-lg border border-border bg-muted/35 p-2.5">
            <div className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
              <Package className="size-3.5" aria-hidden="true" />
              <span>{copy.directItems}</span>
            </div>
            <div className="mt-1 text-base font-semibold tabular-nums text-foreground">
              {formatNumber(node.usage.directItemCount, lang)}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/35 p-2.5">
            <div className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
              <Layers className="size-3.5" aria-hidden="true" />
              <span>{copy.subtreeItems}</span>
            </div>
            <div className="mt-1 text-base font-semibold tabular-nums text-foreground">
              {formatNumber(node.usage.subtreeItemCount, lang)}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/35 p-2.5">
            <div className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
              <GitBranch className="size-3.5" aria-hidden="true" />
              <span>{copy.descendants}</span>
            </div>
            <div className="mt-1 text-base font-semibold tabular-nums text-foreground">
              {formatNumber(node.usage.descendantCount, lang)}
            </div>
          </div>
        </div>

        {/* Identity & Translations Section */}
        <DetailSection
          title={copy.defaultName}
          emptyValueLabel="—"
          fields={[
            {
              label: copy.code,
              value: <IdentifierText>{node.code}</IdentifierText>,
            },
            { label: copy.defaultName, value: node.displayName },
            ...Object.entries(node.localizedNames).map(([locale, name]) => ({
              label: locale,
              value: name,
            })),
            {
              label: t.trade.updatedAt,
              value: formatDateTime(node.updatedAt, lang),
            },
          ]}
        />

        <DetailSection
          title={copy.directItems}
          emptyValueLabel="—"
          fields={[
            {
              label: copy.directItems,
              value: formatNumber(node.usage.directItemCount, lang),
            },
            {
              label: copy.subtreeItems,
              value: formatNumber(node.usage.subtreeItemCount, lang),
            },
            {
              label: copy.descendants,
              value: formatNumber(node.usage.descendantCount, lang),
            },
          ]}
        />

        {node.usage.hasRetainedItemReferences ? (
          <p className="text-xs text-muted-foreground">
            {copy.retainedReferences}
          </p>
        ) : null}

        {/* Management Commands & Deletion Safety */}
        {state.canManage ? (
          <div className="space-y-3 border-t border-border pt-3">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!state.canWrite || state.busy || state.uncertain}
                onClick={() => state.openEditor("update")}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
                {copy.edit}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={
                  !state.canWrite ||
                  state.busy ||
                  state.uncertain ||
                  !node.effectiveActive ||
                  node.depth >= 8
                }
                onClick={() => state.openEditor("create", true)}
              >
                <FolderPlus className="size-3.5" aria-hidden="true" />
                {copy.addChild}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!state.canWrite || state.busy || state.uncertain}
                onClick={() => state.openEditor("move")}
              >
                <MoveRight className="size-3.5" aria-hidden="true" />
                {copy.move}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={!state.canWrite || state.busy || state.uncertain}
                onClick={() => state.openEditor("reorder")}
              >
                <ArrowUpDown className="size-3.5" aria-hidden="true" />
                {copy.reorder}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={
                  !state.canWrite ||
                  state.busy ||
                  state.uncertain ||
                  (node.status !== "ACTIVE" && node.status !== "INACTIVE")
                }
                onClick={() => state.openEditor("status")}
              >
                <Power className="size-3.5" aria-hidden="true" />
                {node.status === "ACTIVE"
                  ? copy.deactivate
                  : node.status === "INACTIVE"
                    ? copy.activate
                    : copy.status.unknown}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={
                  !state.canWrite ||
                  state.busy ||
                  state.uncertain ||
                  !node.usage.canDelete
                }
                onClick={() => state.openEditor("delete")}
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                {copy.delete}
              </Button>
            </div>

            {node.usage.deleteBlockers.length ? (
              <ul className="list-inside list-disc space-y-1 rounded-md border border-border bg-muted/35 p-2.5 text-xs text-muted-foreground">
                {node.usage.deleteBlockers.map((reason) => (
                  <li key={reason}>{copy.deleteBlockers[reason]}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Modal View One — 360° Category Overview Modal */}
      {isModalOpen ? (
        <CategoryInspectorModal
          node={node}
          workspace={state}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}

function CategoryInspectorModal({
  node,
  workspace: state,
  onClose,
}: {
  node: CategoryDetail;
  workspace: ReturnType<typeof useCategoryWorkspace>;
  onClose: () => void;
}) {
  const { t, lang } = state;
  const copy = t.trade.categories;
  const meta = getCategoryDomainMetadata(
    node.code,
    node.displayName,
    node.depth,
  );
  const palette = SWATCH_SURFACE_PALETTES[meta.hue];

  return (
    <FormModal
      open
      size="wide"
      bodyClassName="bg-muted/35 dark:bg-background"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={`${node.name} (${node.code})`}
      description={copy.modalViewDescription}
      headerIcon={
        <div
          className={cn(
            "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg border",
            palette.iconBoxIdle,
          )}
        >
          <FolderTree className="size-5" aria-hidden="true" />
        </div>
      }
      titleBadge={
        <Badge tone={node.effectiveActive ? "positive" : "neutral"}>
          {node.status === "ACTIVE"
            ? node.effectiveActive
              ? copy.status.ACTIVE
              : copy.inheritedInactive
            : node.status === "INACTIVE"
              ? copy.status.INACTIVE
              : copy.status.unknown}
        </Badge>
      }
      asideSlot={
        <div className="flex flex-col gap-3.5 p-4">
          {/* Usage Analytics Card */}
          <div className="grid gap-2.5 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
            <span className="text-xs font-semibold text-foreground">
              {copy.usageMetricsTitle}
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md border border-border bg-muted/35 p-2.5 text-center">
                <div className="text-2xs text-muted-foreground">
                  {copy.directItems}
                </div>
                <div className="mt-1 text-base font-semibold tabular-nums text-foreground">
                  {formatNumber(node.usage.directItemCount, lang)}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/35 p-2.5 text-center">
                <div className="text-2xs text-muted-foreground">
                  {copy.subtreeItems}
                </div>
                <div className="mt-1 text-base font-semibold tabular-nums text-foreground">
                  {formatNumber(node.usage.subtreeItemCount, lang)}
                </div>
              </div>
              <div className="rounded-md border border-border bg-muted/35 p-2.5 text-center">
                <div className="text-2xs text-muted-foreground">
                  {copy.descendants}
                </div>
                <div className="mt-1 text-base font-semibold tabular-nums text-foreground">
                  {formatNumber(node.usage.descendantCount, lang)}
                </div>
              </div>
            </div>
            {node.usage.hasRetainedItemReferences ? (
              <p className="text-2xs text-muted-foreground">
                {copy.retainedReferences}
              </p>
            ) : null}
          </div>

          {/* Deletion Readiness & Blockers Card */}
          <div className="grid gap-2.5 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                {copy.deletionSafetyTitle}
              </span>
              <Badge
                tone={node.usage.canDelete ? "positive" : "caution"}
                className="rounded-full px-2 py-0.5 text-2xs"
              >
                {node.usage.canDelete
                  ? copy.deletionEligible
                  : copy.deletionProtected}
              </Badge>
            </div>
            {node.usage.deleteBlockers.length > 0 ? (
              <ul className="grid gap-1.5 text-xs">
                {node.usage.deleteBlockers.map((blocker) => (
                  <li
                    key={blocker}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/35 px-2.5 py-2 text-muted-foreground"
                  >
                    <ShieldAlert
                      className="size-4 shrink-0 text-warning-subtle-foreground"
                      aria-hidden="true"
                    />
                    <span>{copy.deleteBlockers[blocker]}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2 rounded-md border border-border bg-success-subtle/30 px-2.5 py-2 text-xs text-success-subtle-foreground">
                <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />
                <span>{copy.deletionEligible}</span>
              </div>
            )}
          </div>
        </div>
      }
      isDirty={false}
      isSubmitting={false}
      onSubmit={onClose}
      labels={{
        submit: t.common.close,
        cancel: t.common.close,
        discardTitle: t.common.discardTitle,
        discardDescription: t.common.discardDescription,
        discardConfirm: t.common.discardConfirm,
        discardCancel: t.common.cancel,
        sections: copy.translations,
        sectionInvalid: copy.formInvalid,
        close: t.common.close,
      }}
    >
      <div className="grid gap-4">
        {/* 1. Hierarchy Path Ladder */}
        <div className="grid gap-2.5 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-foreground">
              {copy.hierarchyLadderTitle}
            </span>
            <span className="text-2xs text-muted-foreground">
              {formatTemplate(copy.levelBadge, {
                depth: formatNumber(node.depth, lang),
              })}
            </span>
          </div>
          <div className="grid gap-2">
            {node.path.map((segment, index) => {
              const segDepth = index + 1;
              const segHue = getCategoryDepthHue(segDepth);
              const segPalette = SWATCH_SURFACE_PALETTES[segHue];
              const isCurrent = segment.id === node.id;
              return (
                <div
                  key={segment.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-2 rounded-md border p-2.5 text-xs",
                    isCurrent
                      ? cn(segPalette.sectionCard, segPalette.accentBorder, "border-s-4")
                      : "border-border bg-muted/35",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium",
                        segPalette.badge,
                      )}
                    >
                      {formatTemplate(copy.levelBadge, {
                        depth: formatNumber(segDepth, lang),
                      })}
                    </span>
                    <IdentifierText className="rounded-sm border border-border bg-card px-1.5 py-0.5 text-xs font-semibold">
                      {segment.code}
                    </IdentifierText>
                    <span className="font-semibold text-foreground">
                      {segment.name}
                    </span>
                  </div>
                  <span className="text-2xs text-muted-foreground">
                    {formatTemplate(copy.siblingPositionLabel, {
                      pos: formatNumber(segment.siblingPosition, lang),
                      total: formatNumber(segment.siblingTotal, lang),
                    })}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. Translations & Identity Grid */}
        <div className="grid gap-2.5 rounded-lg border border-border bg-card p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5">
            <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-xs font-semibold text-foreground">
              {copy.translations}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(node.localizedNames).map(([locale, val]) => (
              <div
                key={locale}
                className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/35 px-3 py-2 text-xs"
              >
                <IdentifierText className="rounded-sm border border-border bg-card px-1.5 py-0.5 text-2xs font-semibold">
                  {locale}
                </IdentifierText>
                <span className="font-medium text-foreground">{val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </FormModal>
  );
}
