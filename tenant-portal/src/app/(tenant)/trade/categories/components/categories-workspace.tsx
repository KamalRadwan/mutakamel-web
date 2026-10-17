"use client";

import { useState } from "react";
import {
  CheckCircle2,
  FolderTree,
  LayoutGrid,
  Layers,
  List,
  Plus,
  Power,
  RefreshCw,
} from "lucide-react";
import {
  Button,
  cn,
  ConflictDialog,
  FilterBar,
  IdentifierText,
  PageHeader,
  PermissionGate,
  ReadOnlyGate,
  SWATCH_SURFACE_PALETTES,
} from "@/design-system";
import { formatNumber } from "@/lib/format/number";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { useCategoryWorkspace } from "../hooks/useCategoryWorkspace";
import { CategoryDetailPanel } from "./CategoryDetailPanel";
import { CategoryEditor } from "./CategoryEditor";
import { CategoryListPanel } from "./CategoryListPanel";
import { CategoryTreePanel } from "./CategoryTreePanel";

export function CategoriesWorkspace({ initialId }: { initialId?: string }) {
  const state = useCategoryWorkspace(initialId);
  const { t } = state;
  const copy = t.trade.categories;
  const [listVariant, setListVariant] = useState<"list" | "cards">("list");
  const [modalInspectOpen, setModalInspectOpen] = useState(false);

  const knownNodes = new Map([
    ...[...state.tree.pages.values()].flatMap((page) =>
      page.items.map((node) => [node.id, node] as const),
    ),
    ...(state.list.data?.items.map((node) => [node.id, node] as const) ?? []),
  ]);

  const allKnown = [...knownNodes.values()];
  const totalCategories =
    state.list.data?.total ??
    state.tree.pages.get("ROOT")?.total ??
    allKnown.length;
  const activeCount = allKnown.filter((node) => node.effectiveActive).length;
  const inactiveCount = allKnown.filter((node) => !node.effectiveActive).length;
  const maxDepth =
    allKnown.length > 0
      ? Math.max(
          ...allKnown.map((node) => node.depth),
          state.detail.data?.depth ?? 1,
        )
      : (state.detail.data?.depth ?? 0);

  return (
    <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
      <ReadOnlyGate
        mode={state.access.mode}
        labels={{
          blockedTitle: copy.blocked,
          blockedDescription: copy.readOnly,
          readOnlyNotice: copy.readOnly,
          dunningNotice: copy.readOnly,
        }}
      >
        <div className="flex flex-col gap-2.5">
          <PageHeader
            className="sr-only"
            title={copy.title}
            headingRef={state.headingRef}
            description={copy.subtitle}
            primaryAction={
              state.canManage
                ? {
                    label: copy.add,
                    icon: <Plus className="size-4" aria-hidden="true" />,
                    onClick: () => state.openEditor("create"),
                    disabled:
                      !state.canWrite ||
                      state.busy ||
                      state.uncertain ||
                      state.tree.treeVersion === null,
                  }
                : undefined
            }
            secondaryActions={
              <Button
                variant="outline"
                size="sm"
                onClick={() => void state.reload()}
              >
                <RefreshCw className="size-4" aria-hidden="true" />
                {t.trade.reload}
              </Button>
            }
          />

          {/* Compact Small 4-Card KPI Summary Strip */}
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <div
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.indigo.sectionCard,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md border",
                    SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle,
                  )}
                >
                  <FolderTree className="size-3.5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {copy.kpiTotalTitle}
                  </span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {copy.kpiTotalHint}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-base font-semibold tabular-nums leading-none text-foreground">
                <IdentifierText>
                  {formatNumber(totalCategories, state.lang)}
                </IdentifierText>
              </span>
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.green.sectionCard,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md border",
                    SWATCH_SURFACE_PALETTES.green.iconBoxIdle,
                  )}
                >
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {copy.kpiActiveTitle}
                  </span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {copy.kpiActiveHint}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-base font-semibold tabular-nums leading-none text-foreground">
                <IdentifierText>
                  {formatNumber(activeCount, state.lang)}
                </IdentifierText>
              </span>
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.amber.sectionCard,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md border",
                    SWATCH_SURFACE_PALETTES.amber.iconBoxIdle,
                  )}
                >
                  <Power className="size-3.5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {copy.kpiInactiveTitle}
                  </span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {copy.kpiInactiveHint}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-base font-semibold tabular-nums leading-none text-foreground">
                <IdentifierText>
                  {formatNumber(inactiveCount, state.lang)}
                </IdentifierText>
              </span>
            </div>

            <div
              className={cn(
                "flex items-center justify-between gap-2 rounded-lg border px-3 py-1.5 shadow-2xs",
                SWATCH_SURFACE_PALETTES.purple.sectionCard,
              )}
            >
              <div className="flex min-w-0 items-center gap-2">
                <div
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-md border",
                    SWATCH_SURFACE_PALETTES.purple.iconBoxIdle,
                  )}
                >
                  <Layers className="size-3.5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-foreground">
                    {copy.kpiDepthTitle}
                  </span>
                  <span className="block truncate text-2xs text-muted-foreground">
                    {copy.kpiDepthHint}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-sm font-semibold tabular-nums leading-none text-foreground">
                <IdentifierText>
                  {`${formatNumber(maxDepth, state.lang)} / ${formatNumber(8, state.lang)}`}
                </IdentifierText>
              </span>
            </div>
          </div>

          {/* View Mode Switcher Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant={state.mode === "tree" ? "secondary" : "outline"}
                size="sm"
                className="gap-1.5"
                aria-pressed={state.mode === "tree"}
                onClick={() => state.setMode("tree")}
              >
                <FolderTree className="size-3.5" aria-hidden="true" />
                {copy.tree}
              </Button>
              <Button
                variant={
                  state.mode === "list" && listVariant === "list"
                    ? "secondary"
                    : "outline"
                }
                size="sm"
                className="gap-1.5"
                aria-pressed={state.mode === "list" && listVariant === "list"}
                onClick={() => {
                  setListVariant("list");
                  state.setMode("list");
                }}
              >
                <List className="size-3.5" aria-hidden="true" />
                {copy.list}
              </Button>
              <Button
                variant={
                  state.mode === "list" && listVariant === "cards"
                    ? "secondary"
                    : "outline"
                }
                size="sm"
                className="gap-1.5"
                aria-pressed={state.mode === "list" && listVariant === "cards"}
                onClick={() => {
                  setListVariant("cards");
                  state.setMode("list");
                }}
              >
                <LayoutGrid className="size-3.5" aria-hidden="true" />
                {copy.cards}
              </Button>
              {state.selectedId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => state.select(null)}
                >
                  {copy.back}
                </Button>
              ) : null}
            </div>
          </div>

          {state.savedRefreshFailed ? (
            <div className="flex items-center gap-2 text-sm" role="status">
              <p>{copy.savedRefreshFailed}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void state.reload()}
              >
                {t.common.retry}
              </Button>
            </div>
          ) : null}

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <div
              className={
                state.selectedId && !state.mobileBrowse
                  ? "hidden min-w-0 space-y-3 lg:block"
                  : "min-w-0 space-y-3"
              }
            >
              <FilterBar
                filters={[
                  {
                    id: "status",
                    kind: "select",
                    label: t.common.status,
                    placeholder: t.trade.statusAny,
                    options: [
                      { value: "ACTIVE", label: copy.status.ACTIVE },
                      { value: "INACTIVE", label: copy.status.INACTIVE },
                    ],
                  },
                ]}
                values={
                  state.status
                    ? { status: { kind: "select", value: state.status } }
                    : {}
                }
                onChange={(next) => {
                  const value = next.status;
                  state.setStatus(
                    value?.kind === "select" &&
                      (value.value === "ACTIVE" || value.value === "INACTIVE")
                      ? value.value
                      : undefined,
                  );
                }}
                onReset={() => state.setStatus(undefined)}
                searchValue={state.search}
                onSearchChange={state.setSearch}
                searchPlaceholder={copy.search}
                clearAllLabel={t.trade.clearFilters}
                filtersLabel={t.common.filter}
              />
              {state.mode === "tree" ? (
                <CategoryTreePanel
                  tree={state.tree}
                  selectedId={state.selectedId}
                  onSelect={state.select}
                />
              ) : (
                <CategoryListPanel
                  list={state.list}
                  page={state.page}
                  selectedId={state.selectedId}
                  viewVariant={listVariant}
                  onPage={state.setPage}
                  onSelect={state.select}
                  onInspect={(id) => {
                    state.select(id);
                    setModalInspectOpen(true);
                  }}
                />
              )}
            </div>
            <div
              className={
                state.selectedId && !state.mobileBrowse
                  ? "min-w-0"
                  : "hidden min-w-0 lg:block"
              }
            >
              <CategoryDetailPanel
                workspace={state}
                modalOpen={modalInspectOpen}
                onModalOpenChange={setModalInspectOpen}
              />
            </div>
          </div>

          {state.editor ? (
            <CategoryEditor
              editor={state.editor}
              busy={state.busy}
              uncertain={state.uncertain}
              canWrite={state.canWrite}
              error={
                state.command.kind === "rejected"
                  ? {
                      ...state.command.error,
                      message: state.command.error.message ?? copy.saveFailed,
                    }
                  : undefined
              }
              onSubmit={state.submit}
              onClose={state.closeEditor}
              onRetry={() => void state.retry()}
            />
          ) : null}

          <ConflictDialog
            open={state.conflict}
            onOpenChange={(open) => {
              if (!open) state.dismissConflict();
            }}
            title={t.trade.conflictTitle}
            description={t.trade.conflictDescription}
            loading={state.reviewing}
            yourChanges={
              state.editor?.source
                ? `${state.editor.source.name} · ${formatNumber(state.editor.source.version, state.lang)}`
                : undefined
            }
            theirChanges={
              state.editor?.source
                ? state.conflictCurrent
                  ? `${state.conflictCurrent.name} · ${formatNumber(state.conflictCurrent.version, state.lang)}`
                  : t.common.loading
                : undefined
            }
            onReload={() => void state.reviewConflict()}
            onCancel={state.dismissConflict}
            labels={{
              yourChanges: copy.versionStarted,
              theirChanges: copy.versionCurrent,
              reload: t.trade.conflictReload,
              overwrite: t.trade.conflictReload,
              cancel: t.common.cancel,
            }}
          />
        </div>
      </ReadOnlyGate>
    </PermissionGate>
  );
}
