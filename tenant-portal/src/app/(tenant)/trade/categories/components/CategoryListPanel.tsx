"use client";

import { Eye, FolderTree } from "lucide-react";
import {
  Badge,
  Button,
  cn,
  DataTable,
  EmptyState,
  ErrorState,
  IdentifierText,
  Skeleton,
  SWATCH_SURFACE_PALETTES,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { getCategoryDomainMetadata } from "../category-catalogue-metadata";
import { CATEGORY_PAGE_SIZE } from "../category-contract";
import type { useCategoryList } from "../hooks/useCategoryReads";

export function CategoryListPanel({
  list,
  page,
  selectedId,
  viewVariant = "list",
  onPage,
  onSelect,
  onInspect,
}: {
  list: ReturnType<typeof useCategoryList>;
  page: number;
  selectedId?: string | null;
  viewVariant?: "list" | "cards";
  onPage: (page: number) => void;
  onSelect: (id: string) => void;
  onInspect?: (id: string) => void;
}) {
  const { t, lang } = useI18n();
  const copy = t.trade.categories;
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  if (viewVariant === "cards") {
    if (list.loading && items.length === 0) {
      return <Skeleton className="h-64 w-full" />;
    }
    if (list.error) {
      return (
        <ErrorState
          title={copy.loadFailed}
          retryLabel={t.common.retry}
          onRetry={() => void list.reload()}
        />
      );
    }
    if (items.length === 0) {
      return (
        <EmptyState
          icon={FolderTree}
          title={copy.noMatches}
          description={copy.emptyDescription}
        />
      );
    }

    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((node) => {
            const meta = getCategoryDomainMetadata(
              node.code,
              node.displayName,
              node.depth,
            );
            const palette = SWATCH_SURFACE_PALETTES[meta.hue];
            const depthPalette = SWATCH_SURFACE_PALETTES[meta.depthHue];
            const isSelected = selectedId === node.id;

            return (
              <div
                key={node.id}
                className={cn(
                  "flex flex-col justify-between gap-3 rounded-lg border border-s-4 bg-card p-3.5 shadow-2xs transition-colors",
                  palette.accentBorder,
                  isSelected && palette.tileActive,
                )}
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <IdentifierText className="rounded-sm border border-border bg-muted/40 px-1.5 py-0.5 text-2xs font-semibold">
                        {node.code}
                      </IdentifierText>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium",
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
                    </div>
                    <Badge tone={node.effectiveActive ? "positive" : "neutral"}>
                      {node.status === "ACTIVE"
                        ? node.effectiveActive
                          ? copy.status.ACTIVE
                          : copy.inheritedInactive
                        : node.status === "INACTIVE"
                          ? copy.status.INACTIVE
                          : copy.status.unknown}
                    </Badge>
                  </div>

                  <div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-0 text-start text-sm font-semibold text-foreground hover:underline"
                      onClick={() => onSelect(node.id)}
                    >
                      {node.name}
                    </Button>
                    <p className="mt-0.5 text-2xs text-muted-foreground">
                      {node.path.map((entry) => entry.name).join(" / ")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
                  <span className="text-2xs text-muted-foreground">
                    {formatTemplate(copy.siblingPositionLabel, {
                      pos: formatNumber(
                        node.path.at(-1)?.siblingPosition ?? 1,
                        lang,
                      ),
                      total: formatNumber(
                        node.path.at(-1)?.siblingTotal ?? 1,
                        lang,
                      ),
                    })}
                  </span>
                  <div className="flex items-center gap-1">
                    {onInspect ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="gap-1"
                        onClick={() => onInspect(node.id)}
                      >
                        <Eye className="size-3.5" aria-hidden="true" />
                        {copy.openModalView}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {total > CATEGORY_PAGE_SIZE ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <span className="text-xs text-muted-foreground">
              {formatTemplate(copy.pageSummary, {
                page: formatNumber(page, lang),
                total: formatNumber(total, lang),
              })}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={list.loading || !list.data?.hasPrev}
                onClick={() => onPage(page - 1)}
              >
                {t.common.previousPage}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={list.loading || !list.data?.hasNext}
                onClick={() => onPage(page + 1)}
              >
                {t.common.nextPage}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <DataTable
      density="compact"
      rows={items}
      rowKey={(node) => node.id}
      isLoading={list.loading}
      error={list.error}
      onRetry={() => void list.reload()}
      onPageChange={onPage}
      page={{ page, limit: CATEGORY_PAGE_SIZE, total }}
      columns={[
        {
          id: "name",
          header: copy.defaultName,
          cell: (node) => {
            const meta = getCategoryDomainMetadata(
              node.code,
              node.displayName,
              node.depth,
            );
            const palette = SWATCH_SURFACE_PALETTES[meta.hue];
            const depthPalette = SWATCH_SURFACE_PALETTES[meta.depthHue];
            return (
              <div className="flex flex-wrap items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="xs"
                  className="font-semibold"
                  onClick={() => onSelect(node.id)}
                >
                  {node.name}
                </Button>
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium",
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
              </div>
            );
          },
        },
        {
          id: "code",
          header: copy.code,
          cell: (node) => <IdentifierText>{node.code}</IdentifierText>,
        },
        {
          id: "path",
          header: copy.path,
          cell: (node) => node.path.map((entry) => entry.name).join(" / "),
        },
        {
          id: "status",
          header: t.common.status,
          cell: (node) => (
            <Badge tone={node.effectiveActive ? "positive" : "neutral"}>
              {node.status === "ACTIVE"
                ? node.effectiveActive
                  ? copy.status.ACTIVE
                  : copy.inheritedInactive
                : node.status === "INACTIVE"
                  ? copy.status.INACTIVE
                  : copy.status.unknown}
            </Badge>
          ),
        },
      ]}
      labels={{
        retry: t.common.retry,
        errorTitle: copy.loadFailed,
        emptyTitle: copy.noMatches,
        selectAll: t.common.actions,
        selectRow: t.common.actions,
        sortAscending: t.common.actions,
        sortDescending: t.common.actions,
        notSorted: t.common.actions,
        pagination: {
          previous: t.common.previousPage,
          next: t.common.nextPage,
          summary: (from, to, count) =>
            formatTemplate(t.common.showingOf, {
              from: formatNumber(from, lang),
              to: formatNumber(to, lang),
              total: formatNumber(count, lang),
            }),
        },
      }}
    />
  );
}
