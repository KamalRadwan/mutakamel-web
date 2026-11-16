"use client";

import { compareFixedDecimal } from "../documents/fixed-decimal";
import * as React from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  Eye,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  DataTable,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Field,
  IdentifierText,
  Input,
  Money,
  PageActions,
  PageHeader,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  ViewSwitcher,
  type ColumnDef,
  type RecordWorkspaceView,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeIfMatch, tradePost } from "../trade-api";
import {
  TRADE_ACTION_RESPONSE_BYTES,
  partyDisplayName,
  tradeDocumentActionPath,
} from "../documents/trade-document-contract";
import {
  TradeScopeRequired,
  TradeWriteOutcome,
} from "../documents/components/TradeBoundaryStates";
import { TradeGate } from "../documents/components/TradeGate";
import { TradeStatusBadge } from "../documents/components/TradeStatusBadge";
import { useTradeDocumentList } from "../documents/hooks/useTradeDocumentList";
import { useTradeTableLabels } from "../documents/hooks/useTradeTableLabels";
import { useTradeWrite } from "../documents/hooks/useTradeWrite";
import { QuotationBoardView } from "./components/QuotationBoardView";
import { QuotationCardsView } from "./components/QuotationCardsView";
import { QuotationDeleteGuardModal } from "./components/QuotationDeleteGuardModal";
import { QuotationMiniViewModal } from "./components/QuotationMiniViewModal";
import { QuotationReasonModal } from "./components/QuotationReasonModal";
import { QuotationShareButtons } from "./components/QuotationShareButtons";
import {
  QUOTATIONS_PATH,
  QUOTATION_LIFECYCLE_STATUSES,
  QUOTATION_PERMISSIONS,
  parseQuotation,
  type Quotation,
  type QuotationReasonPayload,
} from "./quotation-contract";

type QuotationSortOrder = "newest" | "oldest" | "highestTotal";

const ANY_STATUS_VALUE = "__ANY__";

export default function QuotationsPage() {
  const { t } = useI18n();
  const td = t.tradeDocuments;
  const qCopy = td.quotations;

  const list = useTradeDocumentList<Quotation>(QUOTATIONS_PATH, parseQuotation);
  const canCreate = list.scope.canWrite(QUOTATION_PERMISSIONS.create);
  const canCancel = list.scope.canWrite(QUOTATION_PERMISSIONS.cancel);

  const [viewMode, setViewMode] = React.useState<RecordWorkspaceView>("board");
  const [sortOrder, setSortOrder] = React.useState<QuotationSortOrder>("newest");
  const [inspectId, setInspectId] = React.useState<string | null>(null);
  const [deleteBlockedTarget, setDeleteBlockedTarget] = React.useState<Quotation | null>(null);
  const [cancelTarget, setCancelTarget] = React.useState<Quotation | null>(null);

  const cancelWrite = useTradeWrite();

  const labels = useTradeTableLabels(qCopy.empty, qCopy.loadFailed);

  const handleRequestDelete = React.useCallback(
    (quotation: Quotation) => {
      const status = quotation.lifecycleStatus;
      if (status === "DRAFT" || status === "SENT") {
        if (canCancel) {
          cancelWrite.clearWriteError();
          setCancelTarget(quotation);
          return;
        }
      }
      setDeleteBlockedTarget(quotation);
    },
    [canCancel, cancelWrite],
  );

  const handleConfirmCancelFromList = React.useCallback(
    async (_action: "cancel" | "reject", payload: QuotationReasonPayload) => {
      if (!cancelTarget) return;
      await cancelWrite.runWrite({
        operation: qCopy.cancel,
        send: (idempotencyHeaders) =>
          tradePost(
            tradeDocumentActionPath(QUOTATIONS_PATH, cancelTarget.id, "cancel"),
            payload,
            {
              headers: {
                ...list.scope.headers,
                ...idempotencyHeaders,
                "if-match": tradeIfMatch(cancelTarget.version),
              },
              maxResponseBytes: TRADE_ACTION_RESPONSE_BYTES,
            },
          ),
        onSuccess: async () => {
          setCancelTarget(null);
          await list.reload();
        },
      });
    },
    [cancelTarget, cancelWrite, list, qCopy.cancel],
  );

  const filteredItems = React.useMemo(() => {
    const sorted = [...list.items];
    sorted.sort((left, right) => {
      if (sortOrder === "highestTotal") {
        return compareFixedDecimal(right.grandTotal, left.grandTotal);
      }
      if (sortOrder === "oldest") {
        return left.businessDate.localeCompare(right.businessDate);
      }
      return right.businessDate.localeCompare(left.businessDate);
    });
    return sorted;
  }, [list.items, sortOrder]);

  const hasAdvancedFilter =
    Boolean(list.status) || Boolean(list.partyId) || Boolean(list.currencyCode);

  const columns: ColumnDef<Quotation>[] = [
    {
      id: "number",
      header: td.documentNumber,
      cell: (row) => (
        <div className="flex flex-col gap-0.5">
          <Link
            href={`${TENANT_ROUTES.tradeQuotations}/${row.id}`}
            className="font-semibold text-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            <IdentifierText>{row.documentNumber ?? qCopy.unnumberedDraft}</IdentifierText>
          </Link>
          {row.draftReference ? (
            <span className="text-badge text-muted-foreground">
              <IdentifierText>{row.draftReference}</IdentifierText>
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "party",
      header: td.customer,
      cell: (row) => {
        const isCommercial = row.customerEligibilitySource === "ACTIVE_COMMERCIAL_ACCOUNT";
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-medium text-foreground">
              {partyDisplayName(row.partySnapshot) ?? td.notRecorded}
            </span>
            <Badge tone={isCommercial ? "brand" : "neutral"} size="sm">
              {isCommercial ? qCopy.commercialAccountBadge : qCopy.crmProspectBadge}
            </Badge>
          </div>
        );
      },
    },
    {
      id: "status",
      header: t.common.status,
      cell: (row) => (
        <TradeStatusBadge kind="TradeQuotationStatus" value={row.lifecycleStatus} />
      ),
    },
    {
      id: "businessDate",
      header: td.businessDate,
      cell: (row) => <IdentifierText>{row.businessDate}</IdentifierText>,
    },
    {
      id: "total",
      header: td.grandTotal,
      numeric: true,
      cell: (row) => (
        <Money
          value={row.grandTotal}
          currency={row.currencyCode}
          minimumFractionDigits={2}
          maximumFractionDigits={8}
        />
      ),
    },
    {
      id: "share",
      header: qCopy.shareGroupLabel,
      cell: (row) => <QuotationShareButtons quotation={row} />,
    },
    {
      id: "actions",
      header: t.common.actions,
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                aria-label={td.executive.quickInspect}
                onClick={() => setInspectId(row.id)}
                className="size-7 px-0"
              >
                <Eye className="size-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{td.executive.quickInspect}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                aria-label={qCopy.deleteAction}
                onClick={() => handleRequestDelete(row)}
                className="size-7 px-0 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{qCopy.deleteAction}</TooltipContent>
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <TradeGate require={QUOTATION_PERMISSIONS.read}>
      <div className="flex h-full flex-col gap-3">
        {/* Top Action Bar Primary CTA + Standalone Link */}
        <PageHeader
          className="sr-only"
          title={qCopy.title}
          description={qCopy.subtitle}
        />

        {canCreate ? (
          <PageActions slot="primary">
            <Button asChild variant="primary" size="sm">
              <Link href={TENANT_ROUTES.tradeQuotationCreate}>
                <Plus className="size-3.5" aria-hidden="true" />
                <span>{qCopy.create}</span>
              </Link>
            </Button>
          </PageActions>
        ) : null}

        {/* Top Action Bar Search + Advanced Filter Popover */}
        <PageActions slot="search">
          <div className="relative flex min-w-[200px] flex-1 items-center sm:max-w-[280px]">
            <Search
              className="pointer-events-none absolute start-2.5 size-3.5 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              size="sm"
              value={list.search}
              maxLength={120}
              onChange={(event) => list.setSearch(event.target.value)}
              placeholder={qCopy.searchPlaceholder}
              aria-label={qCopy.searchPlaceholder}
              className="h-(--size-toolbar-control) rounded-lg ps-8 pe-7"
            />
            {list.search ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                aria-label={t.coreSettings.clearFilters}
                onClick={() => list.setSearch("")}
                className="absolute end-1.5 size-5 px-0 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" aria-hidden="true" />
              </Button>
            ) : null}
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="toolbar"
                aria-pressed={hasAdvancedFilter}
                className="aria-pressed:border-ring aria-pressed:bg-selected"
              >
                <SlidersHorizontal className="size-3.5" aria-hidden="true" />
                <span>{qCopy.advancedFilters}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-3.5">
              <div className="flex flex-col gap-3">
                <Field label={t.common.status} showLabel>
                  <Select
                    value={list.status || ANY_STATUS_VALUE}
                    onValueChange={(value) => {
                      const nextStatus = value === ANY_STATUS_VALUE ? "" : value;
                      list.setStatus(nextStatus);
                    }}
                  >
                    <SelectTrigger size="sm">
                      <SelectValue placeholder={td.statusAny} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ANY_STATUS_VALUE}>{td.statusAny}</SelectItem>
                      {QUOTATION_LIFECYCLE_STATUSES.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t.statusValues[`TradeQuotationStatus.${status}`] ?? status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                <Field label={qCopy.filterCustomerUuid} showLabel>
                  <Input
                    size="sm"
                    value={list.partyId}
                    onChange={(event) => list.setPartyId(event.target.value)}
                    placeholder="019..."
                  />
                </Field>

                <Field label={qCopy.filterCurrency} showLabel>
                  <Input
                    size="sm"
                    maxLength={3}
                    value={list.currencyCode}
                    onChange={(event) => list.setCurrencyCode(event.target.value)}
                    placeholder="EGP"
                  />
                </Field>

                {hasAdvancedFilter ? (
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        list.setStatus("");
                        list.setPartyId("");
                        list.setCurrencyCode("");
                      }}
                    >
                      {t.coreSettings.clearFilters}
                    </Button>
                  </div>
                ) : null}
              </div>
            </PopoverContent>
          </Popover>
        </PageActions>

        {/* Top Action Bar View Switcher + Sort + Reload */}
        <PageActions slot="view">
          <ViewSwitcher
            value={viewMode}
            onChange={setViewMode}
            available={["board", "card", "table"]}
            labels={{
              board: t.views.board,
              card: t.views.card,
              table: t.views.table,
            }}
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={t.common.filter}
                className="h-(--size-toolbar-control) w-(--size-toolbar-control) rounded-lg px-0"
              >
                <ArrowUpDown className="size-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setSortOrder("newest")}>
                {qCopy.sortNewest}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSortOrder("oldest")}>
                {qCopy.sortOldest}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setSortOrder("highestTotal")}>
                {qCopy.sortHighestTotal}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={td.reload}
            disabled={list.isRefreshing}
            onClick={() => void list.reload()}
            className="h-(--size-toolbar-control) w-(--size-toolbar-control) rounded-lg px-0"
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
          </Button>
        </PageActions>

        {!list.scope.isResolved ? (
          <TradeScopeRequired />
        ) : (
          <>
            <TradeWriteOutcome write={cancelWrite} />

            {viewMode === "board" ? (
              <QuotationBoardView
                items={filteredItems}
                onQuickInspect={setInspectId}
                onRequestDelete={handleRequestDelete}
              />
            ) : viewMode === "card" ? (
              <QuotationCardsView
                items={filteredItems}
                onQuickInspect={setInspectId}
                onRequestDelete={handleRequestDelete}
              />
            ) : (
              <DataTable
                density="compact"
                columns={columns}
                rows={filteredItems}
                rowKey={(row) => row.id}
                isLoading={list.isLoading}
                error={list.queryError}
                onRetry={() => void list.reload()}
                page={list.pageInfo}
                onPageChange={list.setPage}
                labels={labels}
              />
            )}

            {/* Centered Mini View / Quick Inspect Modal */}
            <QuotationMiniViewModal
              open={inspectId !== null}
              onOpenChange={(open) => {
                if (!open) setInspectId(null);
              }}
              items={filteredItems}
              activeId={inspectId}
              onSelectId={setInspectId}
              headers={list.scope.headers}
            />

            {/* Centered Delete Governance / Blocker Modal */}
            <QuotationDeleteGuardModal
              open={deleteBlockedTarget !== null}
              onOpenChange={(open) => {
                if (!open) setDeleteBlockedTarget(null);
              }}
              quotation={deleteBlockedTarget}
            />

            {/* Centered Cancel Reason Modal (for terminating DRAFT / SENT quotes) */}
            {cancelTarget ? (
              <QuotationReasonModal
                open={cancelTarget !== null}
                action="cancel"
                quotation={cancelTarget}
                write={cancelWrite}
                pending={cancelWrite.isWriting}
                onClose={() => setCancelTarget(null)}
                onConfirm={handleConfirmCancelFromList}
              />
            ) : null}
          </>
        )}
      </div>
    </TradeGate>
  );
}
