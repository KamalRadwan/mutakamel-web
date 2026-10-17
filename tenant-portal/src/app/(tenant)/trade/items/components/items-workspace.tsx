"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Boxes,
  Briefcase,
  Check,
  CheckCircle2,
  FolderTree,
  Layers,
  Loader2,
  Package,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import {
  Badge,
  BoardView,
  Button,
  CardView,
  Checkbox,
  EmptyState,
  FilterBar,
  IdentifierText,
  PageActions,
  PageHeader,
  PermissionGate,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SWATCH_SURFACE_PALETTES,
  TableView,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  ViewSwitcher,
  type BoardColumnDef,
  type ColumnDef,
  type FilterValues,
  type WorkspaceViewLabels,
  useWorkspaceView,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatDate } from "@/lib/format/date";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TradeScopeBar } from "../../TradeScopeBar";
import { TRADE_PERMISSIONS } from "../../trade-scope";
import { tradeLocalizedName } from "../../trade-validation";
import { useItems } from "../hooks/useItems";
import { CreateItemModal } from "./CreateItemModal";
import { EditItemDrawer } from "./ItemDrawers";
import { ItemKindIcon } from "./ItemKindIcon";
import { ItemThumb } from "./ItemThumb";
import {
  ITEM_KINDS,
  ITEM_STATUSES,
  isItemKind,
  isItemStatus,
  type Item,
  type ItemKind,
  type ItemStatus,
} from "../item-contract";

const ALL_FILTER_VALUE = "__all__";

/** Micro-badge styling for compact card chips (`HP-Z220-D-WS`, `Product`, `Servers`). */
const MICRO_BADGE_CLASS =
  "h-4 shrink-0 gap-1 rounded-xs border px-1 py-0 text-2xs font-semibold leading-none normal-case tracking-normal whitespace-nowrap";

type BadgeTone = "brand" | "positive" | "caution" | "negative" | "neutral";

function statusTone(status: string): BadgeTone {
  if (status === "ACTIVE") return "positive";
  if (status === "DRAFT") return "caution";
  if (status === "DISCONTINUED") return "negative";
  return "neutral";
}

function itemKindTone(kind: string): BadgeTone {
  if (kind === "COMBO") return "caution";
  if (kind === "SERVICE") return "positive";
  return "brand";
}

function itemKindMicroBadgeClass(kind: string): string {
  if (kind === "SERVICE") return SWATCH_SURFACE_PALETTES.purple.badge;
  if (kind === "COMBO") return SWATCH_SURFACE_PALETTES.amber.badge;
  return SWATCH_SURFACE_PALETTES.blue.badge;
}

function startPicSurfaceClass(item: Item): string {
  if (item.status === "INACTIVE") {
    return "border-swatch-slate/40 bg-swatch-slate-soft text-swatch-slate-deep";
  }
  if (item.status === "DISCONTINUED") {
    return "border-swatch-red/40 bg-swatch-red-soft text-swatch-red-deep";
  }
  if (item.itemKind === "SERVICE") {
    return "border-swatch-purple/35 bg-swatch-purple-soft text-swatch-purple-deep";
  }
  if (item.itemKind === "COMBO") {
    return "border-swatch-amber/35 bg-swatch-amber-soft text-swatch-amber-deep";
  }
  return "border-swatch-blue/35 bg-swatch-blue-soft text-swatch-blue-deep";
}

/**
 * Card surface styling:
 * - Active items sit on a clean default card surface (and do not render a redundant `ACTIVE` badge).
 * - Deactivated / non-active items (`INACTIVE`, `DISCONTINUED`, `DRAFT`) get a distinct tinted background.
 */
function itemCardSurfaceClass(item: Item): string {
  if (item.status === "INACTIVE") {
    return "border-swatch-slate/45 bg-swatch-slate-soft/65 p-2.5 text-muted-foreground shadow-2xs";
  }
  if (item.status === "DISCONTINUED") {
    return "border-swatch-red/40 bg-swatch-red-soft/50 p-2.5 shadow-2xs";
  }
  if (item.status === "DRAFT") {
    return "border-swatch-amber/40 bg-swatch-amber-soft/45 p-2.5 shadow-2xs";
  }
  return "border-border bg-card p-2.5 shadow-2xs hover:border-primary/40";
}

function secondaryLocalizedName(
  names: Record<string, string>,
  lang: string,
  primary: string,
): string | null {
  for (const [locale, value] of Object.entries(names)) {
    const trimmed = value.trim();
    if (locale !== lang && trimmed && trimmed !== primary) return trimmed;
  }
  return null;
}

function extractVariantEntries(
  variantIdentity: Record<string, unknown> | null,
): Array<[string, string]> {
  if (!variantIdentity) return [];
  return Object.entries(variantIdentity)
    .map(([key, rawValue]): [string, string] => {
      const formatted =
        rawValue === null || rawValue === undefined
          ? ""
          : typeof rawValue === "object"
            ? JSON.stringify(rawValue)
            : String(rawValue);
      return [key.trim(), formatted.trim()];
    })
    .filter(([key, value]) => Boolean(key) && Boolean(value));
}

export function ItemsWorkspace() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const items = useItems();
  const [view, setView] = useWorkspaceView("trade-items", "card");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const emptyState = (
    <EmptyState
      title={items.emptyTitle}
      description={items.emptyDescription}
      action={items.emptyAction}
    />
  );

  const viewLabels: WorkspaceViewLabels = {
    retry: t.common.retry,
    errorTitle: t.trade.itemLoadFailed,
    emptyTitle: t.trade.itemEmpty,
    selectAll: t.views.selectAll,
    selectRow: t.views.selectItem,
    sortAscending: t.views.sortAscending,
    sortDescending: t.views.sortDescending,
    notSorted: t.views.notSorted,
    pagination: {
      previous: t.common.previousPage,
      next: t.common.nextPage,
      summary: (from, to, total) => formatTemplate(t.common.showingOf, { from, to, total }),
    },
  };

  const boardColumns: BoardColumnDef[] = ITEM_STATUSES.map((status) => ({
    id: status,
    label: t.trade[`itemStatus_${status}`],
    count: items.items.filter((item) => item.status === status).length,
    outcomeRole:
      status === "ACTIVE"
        ? "positive"
        : status === "DRAFT"
          ? "caution"
          : status === "DISCONTINUED"
            ? "negative"
            : undefined,
  }));

  const filterValues: FilterValues = {
    ...(items.kindFilter ? { itemKind: { kind: "select" as const, value: items.kindFilter } } : {}),
    ...(items.statusFilter ? { status: { kind: "select" as const, value: items.statusFilter } } : {}),
  };

  const totalLoaded = items.items.length;
  const productCount = items.items.filter((item) => item.itemKind === "PRODUCT").length;
  const serviceCount = items.items.filter((item) => item.itemKind === "SERVICE").length;
  const comboCount = items.items.filter((item) => item.itemKind === "COMBO").length;
  const activeCount = items.items.filter((item) => item.status === "ACTIVE").length;

  const pct = (count: number) =>
    totalLoaded > 0 ? `${Math.round((count / totalLoaded) * 100)}%` : "0%";

  const statusBadge = (item: Item) => (
    <Badge
      tone={statusTone(item.status)}
      className={`${MICRO_BADGE_CLASS} border-transparent`}
    >
      {isItemStatus(item.status) ? t.trade[`itemStatus_${item.status}`] : item.status}
    </Badge>
  );

  const renderCategoryBadge = (item: Item) => {
    if (!item.categorySummary) {
      return (
        <Badge
          tone="neutral"
          className={`${MICRO_BADGE_CLASS} ${SWATCH_SURFACE_PALETTES.slate.badge}`}
        >
          {t.trade.categories.none}
        </Badge>
      );
    }
    return (
      <Badge
        tone={item.categorySummary.effectiveActive ? "positive" : "caution"}
        className={`${MICRO_BADGE_CLASS} max-w-36 ${
          item.categorySummary.effectiveActive
            ? SWATCH_SURFACE_PALETTES.teal.badge
            : SWATCH_SURFACE_PALETTES.amber.badge
        }`}
      >
        {item.categorySummary.effectiveActive ? (
          <FolderTree className="size-2.5 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="size-2.5 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{item.categorySummary.name}</span>
      </Badge>
    );
  };

  const renderEditAction = (item: Item) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          className="size-6 px-0"
          aria-label={
            items.editLoadingId === item.id ? t.trade.itemEditLoading : t.trade.itemEditTitle
          }
          disabled={items.isSubmitting || items.editLoadingId !== null}
          aria-busy={items.editLoadingId === item.id || undefined}
          onClick={() => void items.openEdit(item)}
        >
          {items.editLoadingId === item.id ? (
            <Loader2 className="size-3 animate-spin" aria-hidden="true" />
          ) : (
            <Pencil className="size-3" aria-hidden="true" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t.trade.itemEditTitle}</TooltipContent>
    </Tooltip>
  );

  const renderName = (item: Item) => {
    const primary = tradeLocalizedName(item.localizedNames, lang) || item.canonicalCode;
    const secondary = secondaryLocalizedName(item.localizedNames, lang, primary);
    return (
      <div className="flex items-center gap-2.5">
        <ItemThumb
          itemId={item.id}
          kind={item.itemKind}
          image={item.image}
          alt=""
          className={`size-8 shadow-2xs ${startPicSurfaceClass(item)}`}
          iconClassName="size-3.5"
        />
        <div className="flex min-w-0 flex-col">
          <Link
            href={`${TENANT_ROUTES.tradeItems}/${item.id}`}
            className="truncate font-semibold text-foreground hover:underline"
          >
            {primary}
          </Link>
          {secondary ? (
            <span className="truncate text-2xs text-muted-foreground">{secondary}</span>
          ) : null}
        </div>
      </div>
    );
  };

  const columns: ColumnDef<Item>[] = [
    { id: "name", header: t.trade.itemDetailTitle, cell: renderName },
    {
      id: "canonicalCode",
      header: t.trade.itemCode,
      cell: (item) => (
        <Badge
          tone="neutral"
          className={`${MICRO_BADGE_CLASS} ${SWATCH_SURFACE_PALETTES.slate.badge}`}
        >
          <IdentifierText className="whitespace-nowrap">{item.canonicalCode}</IdentifierText>
        </Badge>
      ),
    },
    {
      id: "itemKind",
      header: t.trade.itemKind,
      cell: (item) => (
        <Badge
          tone={itemKindTone(item.itemKind)}
          className={`${MICRO_BADGE_CLASS} ${itemKindMicroBadgeClass(item.itemKind)}`}
        >
          <ItemKindIcon kind={item.itemKind} className="size-2.5 shrink-0" />
          <span>
            {isItemKind(item.itemKind) ? t.trade[`itemKind_${item.itemKind}`] : item.itemKind}
          </span>
        </Badge>
      ),
    },
    {
      id: "category",
      header: t.trade.itemCategory,
      cell: renderCategoryBadge,
    },
    {
      id: "variantIdentity",
      header: t.trade.itemVariantAttributes,
      cell: (item) => {
        const entries = extractVariantEntries(item.variantIdentity);
        if (entries.length === 0) return "—";
        return (
          <span className="flex flex-wrap gap-1">
            {entries.slice(0, 2).map(([key, value]) => (
              <Badge
                key={key}
                tone="neutral"
                className={`${MICRO_BADGE_CLASS} ${SWATCH_SURFACE_PALETTES.indigo.badge}`}
              >
                <IdentifierText className="whitespace-nowrap">{`${key}: ${value}`}</IdentifierText>
              </Badge>
            ))}
            {entries.length > 2 ? (
              <Badge
                tone="neutral"
                className={`${MICRO_BADGE_CLASS} ${SWATCH_SURFACE_PALETTES.slate.badge}`}
              >
                <IdentifierText className="whitespace-nowrap">{`+${entries.length - 2}`}</IdentifierText>
              </Badge>
            ) : null}
          </span>
        );
      },
    },
    { id: "status", header: t.common.status, cell: statusBadge },
    {
      id: "eligibility",
      header: t.trade.companyProfileTitle,
      cell: (item) =>
        item.eligibility ? (
          <span className="flex flex-wrap gap-1">
            {item.eligibility.canSell ? (
              <Badge tone="positive" className={`${MICRO_BADGE_CLASS} border-transparent`}>
                {t.trade.canSell}
              </Badge>
            ) : null}
            {item.eligibility.canPurchase ? (
              <Badge tone="brand" className={`${MICRO_BADGE_CLASS} border-transparent`}>
                {t.trade.canPurchase}
              </Badge>
            ) : null}
            {item.eligibility.canPos ? (
              <Badge tone="caution" className={`${MICRO_BADGE_CLASS} border-transparent`}>
                {t.trade.canPos}
              </Badge>
            ) : null}
            {item.eligibility.isAssorted ? (
              <Badge tone="positive" className={`${MICRO_BADGE_CLASS} border-transparent`}>
                <Check className="size-2.5 shrink-0" aria-hidden="true" />
                <span>{t.trade.isAssorted}</span>
              </Badge>
            ) : null}
          </span>
        ) : (
          "—"
        ),
    },
    { id: "updatedAt", header: t.trade.updatedAt, cell: (item) => formatDate(item.updatedAt, lang) },
    ...(items.canManage
      ? [
          {
            id: "actions",
            header: t.common.actions,
            align: "end" as const,
            sticky: "end" as const,
            width: "3.5rem",
            cell: renderEditAction,
          },
        ]
      : []),
  ];

  /**
   * Compact horizontal `Start Pic + Content` card anatomy:
   * - Start side (`start`): Prominent `size-12` (`48×48px`) colorful thumbnail picture.
   * - Adjacent content column (`content`):
   *   - Row 1: Primary name (and optional secondary translation only — no verbose description)
   *     + non-active status badge only when deactivated (`status !== "ACTIVE"`).
   *   - Row 2: Very small micro-badges (`itemKind`, `categorySummary`).
   */
  const renderCard = (item: Item) => {
    const primary = tradeLocalizedName(item.localizedNames, lang) || item.canonicalCode;
    const secondary = secondaryLocalizedName(item.localizedNames, lang, primary);

    return (
      <div className="flex items-center gap-3">
        <ItemThumb
          itemId={item.id}
          kind={item.itemKind}
          image={item.image}
          alt=""
          className={`size-12 rounded-xl shadow-2xs ${startPicSurfaceClass(item)}`}
          iconClassName="size-6"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-1.5">
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-xs font-semibold text-foreground">{primary}</span>
              {secondary ? (
                <span className="truncate text-2xs text-muted-foreground">{secondary}</span>
              ) : null}
            </div>
            {view !== "board" && item.status !== "ACTIVE" ? statusBadge(item) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Badge
              tone={itemKindTone(item.itemKind)}
              className={`${MICRO_BADGE_CLASS} ${itemKindMicroBadgeClass(item.itemKind)}`}
            >
              <ItemKindIcon kind={item.itemKind} className="size-2.5 shrink-0" />
              <span>
                {isItemKind(item.itemKind) ? t.trade[`itemKind_${item.itemKind}`] : item.itemKind}
              </span>
            </Badge>
            {renderCategoryBadge(item)}
          </div>
        </div>
      </div>
    );
  };

  const toggleItemSelected = (id: string, next: boolean) => {
    setSelectedIds((current) => {
      const updated = new Set(current);
      if (next) updated.add(id);
      else updated.delete(id);
      return updated;
    });
  };

  const renderCardActions = (item: Item) => (
    <div className="flex items-center gap-1.5">
      {items.canManage ? renderEditAction(item) : null}
      <Checkbox
        checked={selectedIds.has(item.id)}
        onCheckedChange={(next) => toggleItemSelected(item.id, next === true)}
        aria-label={viewLabels.selectRow}
      />
    </div>
  );

  const cardSurfaceClass = (item: Item) =>
    `${itemCardSurfaceClass(item)}${selectedIds.has(item.id) ? " border-primary" : ""}`;

  const renderCardFooter = (item: Item) => {
    const variantEntries = extractVariantEntries(item.variantIdentity);
    const hasVariants = variantEntries.length > 0;
    const hasCombo = item.itemKind === "COMBO" && item.comboComponents.length > 0;
    const hasEligibility = Boolean(
      item.eligibility &&
        (item.eligibility.canSell ||
          item.eligibility.canPurchase ||
          item.eligibility.canPos ||
          item.eligibility.isAssorted),
    );

    if (!hasVariants && !hasCombo && !hasEligibility) {
      return undefined;
    }

    return (
      <div className="flex flex-wrap items-center justify-between gap-1 border-t border-border/50 pt-1 text-2xs text-muted-foreground">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {variantEntries.slice(0, 3).map(([key, value]) => (
            <Badge
              key={key}
              tone="neutral"
              className={`${MICRO_BADGE_CLASS} ${SWATCH_SURFACE_PALETTES.indigo.badge}`}
            >
              <IdentifierText className="whitespace-nowrap">{`${key}: ${value}`}</IdentifierText>
            </Badge>
          ))}
          {variantEntries.length > 3 ? (
            <Badge
              tone="neutral"
              className={`${MICRO_BADGE_CLASS} ${SWATCH_SURFACE_PALETTES.slate.badge}`}
            >
              <IdentifierText className="whitespace-nowrap">{`+${variantEntries.length - 3}`}</IdentifierText>
            </Badge>
          ) : null}
          {hasCombo ? (
            <Badge
              tone="caution"
              className={`${MICRO_BADGE_CLASS} ${SWATCH_SURFACE_PALETTES.amber.badge}`}
            >
              <IdentifierText className="whitespace-nowrap">{`${item.comboComponents.length} SKU`}</IdentifierText>
            </Badge>
          ) : null}
        </div>

        {item.eligibility ? (
          <div className="ms-auto flex shrink-0 flex-wrap items-center gap-1">
            {item.eligibility.canSell ? (
              <Badge tone="positive" className={`${MICRO_BADGE_CLASS} border-transparent`}>
                {t.trade.canSell}
              </Badge>
            ) : null}
            {item.eligibility.canPurchase ? (
              <Badge tone="brand" className={`${MICRO_BADGE_CLASS} border-transparent`}>
                {t.trade.canPurchase}
              </Badge>
            ) : null}
            {item.eligibility.canPos ? (
              <Badge tone="caution" className={`${MICRO_BADGE_CLASS} border-transparent`}>
                {t.trade.canPos}
              </Badge>
            ) : null}
            {item.eligibility.isAssorted ? (
              <Badge tone="positive" className={`${MICRO_BADGE_CLASS} border-transparent`}>
                <Check className="size-2.5 shrink-0" aria-hidden="true" />
                <span>{t.trade.isAssorted}</span>
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <PermissionGate require={TRADE_PERMISSIONS.itemsRead}>
      <div className="flex h-full min-h-full flex-1 flex-col gap-2.5">
        <PageHeader
          className="sr-only"
          title={t.trade.itemsTitle}
          description={t.trade.itemsSubtitle}
          primaryAction={
            items.canManage
              ? {
                  label: t.trade.itemCreate,
                  icon: <Plus className="size-4" aria-hidden="true" />,
                  onClick: items.openCreate,
                }
              : undefined
          }
          secondaryActions={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void items.reload()}
              disabled={items.isRefreshing}
            >
              <RefreshCw
                className={items.isRefreshing ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
              />
              {t.trade.reload}
            </Button>
          }
        />

        {/* Compact Colorful 5-Card Interactive KPI Summary Strip */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          <div
            role="button"
            tabIndex={0}
            aria-pressed={!items.kindFilter && !items.statusFilter}
            onClick={() => {
              items.setKindFilter(undefined);
              items.setStatusFilter(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                items.setKindFilter(undefined);
                items.setStatusFilter(undefined);
              }
            }}
            className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-all ${
              !items.kindFilter && !items.statusFilter
                ? SWATCH_SURFACE_PALETTES.indigo.tileActive
                : "border-swatch-indigo/30 bg-swatch-indigo-soft/45 text-swatch-indigo-deep hover:border-swatch-indigo/60 hover:bg-swatch-indigo-soft/70"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-md border ${
                  !items.kindFilter && !items.statusFilter
                    ? SWATCH_SURFACE_PALETTES.indigo.iconBoxActive
                    : SWATCH_SURFACE_PALETTES.indigo.iconBoxIdle
                }`}
              >
                <Boxes className="size-3.5" aria-hidden="true" />
              </div>
              <span className="truncate text-xs font-semibold">{t.trade.itemsTitle}</span>
            </div>
            <span className="text-base font-semibold leading-none">
              <IdentifierText>{String(items.pageInfo.total)}</IdentifierText>
            </span>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-pressed={items.kindFilter === "PRODUCT"}
            onClick={() =>
              items.setKindFilter(items.kindFilter === "PRODUCT" ? undefined : "PRODUCT")
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                items.setKindFilter(items.kindFilter === "PRODUCT" ? undefined : "PRODUCT");
              }
            }}
            className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-all ${
              items.kindFilter === "PRODUCT"
                ? SWATCH_SURFACE_PALETTES.blue.tileActive
                : "border-swatch-blue/30 bg-swatch-blue-soft/45 text-swatch-blue-deep hover:border-swatch-blue/60 hover:bg-swatch-blue-soft/70"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-md border ${
                  items.kindFilter === "PRODUCT"
                    ? SWATCH_SURFACE_PALETTES.blue.iconBoxActive
                    : SWATCH_SURFACE_PALETTES.blue.iconBoxIdle
                }`}
              >
                <Package className="size-3.5" aria-hidden="true" />
              </div>
              <span className="truncate text-xs font-semibold">{t.trade.itemKind_PRODUCT}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                tone="neutral"
                className={`${MICRO_BADGE_CLASS} ${SWATCH_SURFACE_PALETTES.blue.badge}`}
              >
                <IdentifierText>{pct(productCount)}</IdentifierText>
              </Badge>
              <span className="text-base font-semibold leading-none">
                <IdentifierText>{String(productCount)}</IdentifierText>
              </span>
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-pressed={items.kindFilter === "SERVICE"}
            onClick={() =>
              items.setKindFilter(items.kindFilter === "SERVICE" ? undefined : "SERVICE")
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                items.setKindFilter(items.kindFilter === "SERVICE" ? undefined : "SERVICE");
              }
            }}
            className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-all ${
              items.kindFilter === "SERVICE"
                ? SWATCH_SURFACE_PALETTES.purple.tileActive
                : "border-swatch-purple/30 bg-swatch-purple-soft/45 text-swatch-purple-deep hover:border-swatch-purple/60 hover:bg-swatch-purple-soft/70"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-md border ${
                  items.kindFilter === "SERVICE"
                    ? SWATCH_SURFACE_PALETTES.purple.iconBoxActive
                    : SWATCH_SURFACE_PALETTES.purple.iconBoxIdle
                }`}
              >
                <Briefcase className="size-3.5" aria-hidden="true" />
              </div>
              <span className="truncate text-xs font-semibold">{t.trade.itemKind_SERVICE}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                tone="neutral"
                className={`${MICRO_BADGE_CLASS} ${SWATCH_SURFACE_PALETTES.purple.badge}`}
              >
                <IdentifierText>{pct(serviceCount)}</IdentifierText>
              </Badge>
              <span className="text-base font-semibold leading-none">
                <IdentifierText>{String(serviceCount)}</IdentifierText>
              </span>
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-pressed={items.kindFilter === "COMBO"}
            onClick={() => items.setKindFilter(items.kindFilter === "COMBO" ? undefined : "COMBO")}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                items.setKindFilter(items.kindFilter === "COMBO" ? undefined : "COMBO");
              }
            }}
            className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-all ${
              items.kindFilter === "COMBO"
                ? SWATCH_SURFACE_PALETTES.amber.tileActive
                : "border-swatch-amber/30 bg-swatch-amber-soft/45 text-swatch-amber-deep hover:border-swatch-amber/60 hover:bg-swatch-amber-soft/70"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-md border ${
                  items.kindFilter === "COMBO"
                    ? SWATCH_SURFACE_PALETTES.amber.iconBoxActive
                    : SWATCH_SURFACE_PALETTES.amber.iconBoxIdle
                }`}
              >
                <Layers className="size-3.5" aria-hidden="true" />
              </div>
              <span className="truncate text-xs font-semibold">{t.trade.itemKind_COMBO}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                tone="neutral"
                className={`${MICRO_BADGE_CLASS} ${SWATCH_SURFACE_PALETTES.amber.badge}`}
              >
                <IdentifierText>{pct(comboCount)}</IdentifierText>
              </Badge>
              <span className="text-base font-semibold leading-none">
                <IdentifierText>{String(comboCount)}</IdentifierText>
              </span>
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            aria-pressed={items.statusFilter === "ACTIVE"}
            onClick={() =>
              items.setStatusFilter(items.statusFilter === "ACTIVE" ? undefined : "ACTIVE")
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                items.setStatusFilter(items.statusFilter === "ACTIVE" ? undefined : "ACTIVE");
              }
            }}
            className={`col-span-2 flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-all sm:col-span-1 ${
              items.statusFilter === "ACTIVE"
                ? SWATCH_SURFACE_PALETTES.green.tileActive
                : "border-swatch-green/30 bg-swatch-green-soft/45 text-swatch-green-deep hover:border-swatch-green/60 hover:bg-swatch-green-soft/70"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <div
                className={`flex size-7 shrink-0 items-center justify-center rounded-md border ${
                  items.statusFilter === "ACTIVE"
                    ? SWATCH_SURFACE_PALETTES.green.iconBoxActive
                    : SWATCH_SURFACE_PALETTES.green.iconBoxIdle
                }`}
              >
                <CheckCircle2 className="size-3.5" aria-hidden="true" />
              </div>
              <span className="truncate text-xs font-semibold">{t.trade.itemStatus_ACTIVE}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge
                tone="neutral"
                className={`${MICRO_BADGE_CLASS} ${SWATCH_SURFACE_PALETTES.green.badge}`}
              >
                <IdentifierText>{pct(activeCount)}</IdentifierText>
              </Badge>
              <span className="text-base font-semibold leading-none">
                <IdentifierText>{String(activeCount)}</IdentifierText>
              </span>
            </div>
          </div>
        </div>

        {/* Unified Operating Context Scope & Inline Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-1.5 shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">
              {t.trade.scopeTitle}:
            </span>
            <TradeScopeBar allowItemMaster />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {items.search.trim() ? (
              <span className="text-xs text-muted-foreground">{t.trade.itemSearchNote}</span>
            ) : null}
            <Select
              value={items.kindFilter ?? ALL_FILTER_VALUE}
              onValueChange={(next) =>
                items.setKindFilter(next === ALL_FILTER_VALUE ? undefined : (next as ItemKind))
              }
            >
              <SelectTrigger size="sm" className="w-40" aria-label={t.trade.itemKind}>
                <SelectValue placeholder={t.trade.statusAny} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>
                  {`${t.trade.itemKind}: ${t.trade.statusAny}`}
                </SelectItem>
                {ITEM_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {t.trade[`itemKind_${kind}`]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={items.statusFilter ?? ALL_FILTER_VALUE}
              onValueChange={(next) =>
                items.setStatusFilter(next === ALL_FILTER_VALUE ? undefined : (next as ItemStatus))
              }
            >
              <SelectTrigger size="sm" className="w-40" aria-label={t.common.status}>
                <SelectValue placeholder={t.trade.statusAny} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FILTER_VALUE}>
                  {`${t.common.status}: ${t.trade.statusAny}`}
                </SelectItem>
                {ITEM_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {t.trade[`itemStatus_${status}`]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Multi-Select Context Bar */}
        {selectedIds.size > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/40 bg-selected px-3 py-1.5 text-xs text-selected-foreground shadow-2xs">
            <div className="flex items-center gap-2 font-semibold">
              <Badge tone="brand" className="whitespace-nowrap">
                <IdentifierText className="whitespace-nowrap">{String(selectedIds.size)}</IdentifierText>
              </Badge>
              <span>{t.views.selectAll}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="xs"
                onClick={() => setSelectedIds(new Set(items.items.map((item) => item.id)))}
              >
                {t.views.selectAll}
              </Button>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => setSelectedIds(new Set())}
              >
                {t.trade.clearFilters}
              </Button>
            </div>
          </div>
        ) : null}

        <PageActions slot="view">
          <ViewSwitcher
            value={view}
            onChange={setView}
            available={["board", "card", "table"]}
            labels={{ board: t.views.board, card: t.views.card, table: t.views.table }}
          />
        </PageActions>

        <FilterBar
          filters={[
            {
              id: "itemKind",
              kind: "select",
              label: t.trade.itemKind,
              placeholder: t.trade.statusAny,
              options: ITEM_KINDS.map((kind) => ({
                value: kind,
                label: t.trade[`itemKind_${kind}`],
              })),
            },
            {
              id: "status",
              kind: "select",
              label: t.common.status,
              placeholder: t.trade.statusAny,
              options: ITEM_STATUSES.map((status) => ({
                value: status,
                label: t.trade[`itemStatus_${status}`],
              })),
            },
          ]}
          values={filterValues}
          onChange={(next) => {
            const kind = next.itemKind;
            const status = next.status;
            items.setKindFilter(
              kind?.kind === "select" && kind.value ? (kind.value as ItemKind) : undefined,
            );
            items.setStatusFilter(
              status?.kind === "select" && status.value ? (status.value as ItemStatus) : undefined,
            );
          }}
          onReset={() => {
            items.setKindFilter(undefined);
            items.setStatusFilter(undefined);
          }}
          searchValue={items.search}
          onSearchChange={items.setSearch}
          searchPlaceholder={t.trade.itemSearchPlaceholder}
          clearAllLabel={t.trade.clearFilters}
          filtersLabel={t.common.filter}
        />

        <div className="flex min-h-0 flex-1 flex-col">
          {view === "board" && (
            <BoardView
              className="flex-1 [&>div:first-child>div:not(.w-\(--size-column-collapsed\))]:min-w-72 [&>div:first-child>div:not(.w-\(--size-column-collapsed\))]:flex-1"
              cardClassName={cardSurfaceClass}
              columns={items.items.length === 0 ? [] : boardColumns}
              columnOf={(item) => item.status}
              items={items.items}
              emptyState={emptyState}
              itemKey={(item) => item.id}
              renderCard={renderCard}
              renderActions={renderCardActions}
              renderFooter={renderCardFooter}
              onActivate={(item) => router.push(`${TENANT_ROUTES.tradeItems}/${item.id}`)}
              canDrag={() => items.canManage && items.movingId === null}
              onCardMove={(move) => {
                if (!isItemStatus(move.toColumnId)) return;
                void items.moveToStatus(move.itemId, move.toColumnId);
              }}
              isLoading={items.isLoading}
              error={items.queryError}
              onRetry={() => void items.reload()}
              page={items.pageInfo}
              onPageChange={items.setPage}
              labels={{
                ...viewLabels,
                emptyColumn: t.trade.itemEmpty,
                collapseColumn: t.views.collapseColumn,
                expandColumn: t.views.expandColumn,
              }}
            />
          )}
          {view === "card" && (
            <CardView
              className="flex-1 [&>div:first-child:has(>button[role=checkbox])]:hidden [&_.grid]:grid-cols-1 [&_.grid]:gap-2.5 [&_.grid]:sm:grid-cols-2 [&_.grid]:lg:grid-cols-4 [&_.grid]:xl:grid-cols-4 [&_.grid]:2xl:grid-cols-4"
              cardClassName={cardSurfaceClass}
              items={items.items}
              emptyState={emptyState}
              itemKey={(item) => item.id}
              renderCard={renderCard}
              renderActions={renderCardActions}
              renderFooter={renderCardFooter}
              onActivate={(item) => router.push(`${TENANT_ROUTES.tradeItems}/${item.id}`)}
              isLoading={items.isLoading}
              error={items.queryError}
              onRetry={() => void items.reload()}
              page={items.pageInfo}
              onPageChange={items.setPage}
              labels={{ ...viewLabels, sortBy: t.views.sortBy }}
            />
          )}
          {view === "table" && (
            <TableView
              className="h-full flex-1 justify-between"
              density="compact"
              columns={columns}
              items={items.items}
              emptyState={emptyState}
              itemKey={(item) => item.id}
              selection={{ selectedIds, onSelectionChange: setSelectedIds }}
              onActivate={(item) => router.push(`${TENANT_ROUTES.tradeItems}/${item.id}`)}
              isLoading={items.isLoading}
              error={items.queryError}
              onRetry={() => void items.reload()}
              page={items.pageInfo}
              onPageChange={items.setPage}
              labels={viewLabels}
            />
          )}
        </div>

        <CreateItemModal
          key={items.createOpen ? "create-open" : "create-closed"}
          isOpen={items.createOpen}
          isSubmitting={items.isSubmitting}
          error={items.formError}
          onClose={items.closeCreate}
          onSubmit={items.create}
          imageUpload={items.createImage}
        />

        {items.editing ? (
          <EditItemDrawer
            key={`${items.editing.id}-${items.editRevision}`}
            item={items.editing}
            isSubmitting={items.isSubmitting}
            error={items.formError}
            onClose={items.closeEdit}
            onSubmit={items.update}
            onImageChanged={items.applyImageChange}
            onImageStale={() => void items.reloadEditing()}
          />
        ) : null}
      </div>
    </PermissionGate>
  );
}

