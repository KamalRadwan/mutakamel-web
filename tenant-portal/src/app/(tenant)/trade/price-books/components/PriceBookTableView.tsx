"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Download, Pencil, Plus, Power, Star, X } from "lucide-react";
import {
  Button,
  Checkbox,
  IdentifierText,
  Input,
  Pagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
  type PageInfo,
} from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { tradeStatusLabel } from "../../trade-advanced-validation";
import {
  localizedBookDisplayName,
  type PriceBook,
  type PriceBookStatus,
  type UpdatePriceBookInput,
} from "../pricing-contract";

interface PriceBookTableViewProps {
  items: PriceBook[];
  pageInfo: PageInfo;
  onPageChange: (page: number) => void;
  canManage: boolean;
  canManageDefaults: boolean;
  isDefaultBusy: boolean;
  isBookDefault: (book: PriceBook) => boolean;
  onSetDefault: (book: PriceBook) => Promise<boolean>;
  onUpdateBook: (book: PriceBook, patch: UpdatePriceBookInput) => Promise<boolean>;
  selectedIds: Set<string>;
  onToggleRow: (id: string) => void;
  onToggleAll: () => void;
  onClearSelection: () => void;
  onBulkStatus: (status: PriceBookStatus) => Promise<void>;
  onExportCsv: () => void;
}

interface InlineEditDraft {
  bookId: string;
  primaryName: string;
  secondaryName: string;
}

function secondaryBookSubtitle(book: PriceBook, displayName: string): string | null {
  const arName = book.localizedNames?.ar?.trim() || "";
  const enName = book.localizedNames?.en?.trim() || "";
  if (arName && enName && arName !== enName) {
    return displayName === arName ? enName : arName;
  }
  return null;
}

export function PriceBookTableView({
  items,
  pageInfo,
  onPageChange,
  canManage,
  canManageDefaults,
  isDefaultBusy,
  isBookDefault,
  onSetDefault,
  onUpdateBook,
  selectedIds,
  onToggleRow,
  onToggleAll,
  onClearSelection,
  onBulkStatus,
  onExportCsv,
}: PriceBookTableViewProps) {
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState<InlineEditDraft | null>(null);
  const [isSavingRow, setIsSavingRow] = useState(false);

  const allSelected = items.length > 0 && items.every((b) => selectedIds.has(b.id));
  const someSelected = !allSelected && items.some((b) => selectedIds.has(b.id));

  const startEdit = (book: PriceBook) => {
    const primary = localizedBookDisplayName(book, lang);
    const secondary = secondaryBookSubtitle(book, primary) ?? "";
    setEditing({
      bookId: book.id,
      primaryName: primary,
      secondaryName: secondary,
    });
  };

  const commitEdit = async (book: PriceBook) => {
    if (!editing || editing.bookId !== book.id || isSavingRow) return;
    setIsSavingRow(true);
    try {
      const nextPrimary = editing.primaryName.trim() || book.code;
      const existingAr = book.localizedNames?.ar?.trim() || "";
      const existingEn = book.localizedNames?.en?.trim() || "";
      const updatedAr =
        existingAr === localizedBookDisplayName(book, lang) || !existingEn
          ? nextPrimary
          : editing.secondaryName.trim() || existingAr;
      const updatedEn =
        existingEn && existingAr === localizedBookDisplayName(book, lang)
          ? editing.secondaryName.trim() || existingEn
          : nextPrimary;

      const ok = await onUpdateBook(book, {
        name: updatedEn || updatedAr || book.code,
        localizedNames: {
          ar: updatedAr,
          en: updatedEn,
        },
      });
      if (ok) setEditing(null);
    } finally {
      setIsSavingRow(false);
    }
  };

  return (
    <div className={cn("relative flex flex-col gap-3", selectedIds.size > 0 ? "pb-24" : "pb-4")}>
      <div className="overflow-hidden rounded-column border border-line-card bg-card shadow-column">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface-column-header">
              <TableHead className="w-10">
                <Checkbox
                  aria-label={t.views.selectAll}
                  checked={allSelected ? true : someSelected ? "indeterminate" : false}
                  onCheckedChange={onToggleAll}
                />
              </TableHead>
              <TableHead>{t.tradePricing.tableColCode}</TableHead>
              <TableHead>{t.tradePricing.tableColBilingualName}</TableHead>
              <TableHead>{t.tradePricing.bookPurpose}</TableHead>
              <TableHead>{t.tradePricing.currencyCode}</TableHead>
              <TableHead>{t.tradePricing.tableColDefault}</TableHead>
              <TableHead>{t.tradePricing.tableColPublishedVer}</TableHead>
              <TableHead>{t.tradePricing.tableColPipelineVer}</TableHead>
              <TableHead>{t.tradePricing.tableColItemsPromos}</TableHead>
              <TableHead>{t.tradePricing.cardLinkedAccounts}</TableHead>
              <TableHead>{t.common.status}</TableHead>
              <TableHead className="text-end">{t.common.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((book) => {
              const isRowSelected = selectedIds.has(book.id);
              const isRowEditing = editing?.bookId === book.id;
              const isDefault = isBookDefault(book);
              const isSales = book.purpose === "SALES";
              const displayName = localizedBookDisplayName(book, lang);
              const subtitle = secondaryBookSubtitle(book, displayName);
              const detailHref = `${TENANT_ROUTES.tradePriceBooks}/${book.id}`;

              const publishedVer = book.versions.find(
                (v) => v.status === "PUBLISHED" && !v.supersededAt,
              );
              const retiredVer = !publishedVer
                ? book.versions.find((v) => v.status === "RETIRED")
                : undefined;
              const pipelineVer = book.versions.find(
                (v) =>
                  v.status === "SCHEDULED" || v.status === "TESTED" || v.status === "DRAFT",
              );

              const entriesCount = book.entryCount ?? 0;
              const promosCount = book.promotionCount ?? 0;
              const accountsCount = book.linkedAccountsCount ?? 0;

              return (
                <TableRow
                  key={book.id}
                  data-state={isRowSelected ? "selected" : undefined}
                  className={cn(
                    isRowSelected && "bg-kpi-new-surface/40",
                    isRowEditing && "bg-kpi-new-surface/60",
                  )}
                >
                  <TableCell>
                    <Checkbox
                      aria-label={t.views.selectRow}
                      checked={isRowSelected}
                      onCheckedChange={() => onToggleRow(book.id)}
                    />
                  </TableCell>

                  {/* 1. Reference Code */}
                  <TableCell>
                    <Link
                      href={detailHref}
                      className="font-bold text-primary hover:underline"
                    >
                      <IdentifierText>{book.code}</IdentifierText>
                    </Link>
                  </TableCell>

                  {/* 2. Bilingual Name + Inline PATCH Cell */}
                  <TableCell className="min-w-64">
                    {isRowEditing && editing ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          size="sm"
                          aria-label={t.tradePricing.bookName}
                          value={editing.primaryName}
                          disabled={isSavingRow}
                          onChange={(e) =>
                            setEditing((curr) =>
                              curr ? { ...curr, primaryName: e.target.value } : null,
                            )
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void commitEdit(book);
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="max-w-64 border-primary bg-card font-bold"
                        />
                        <Button
                          type="button"
                          size="xs"
                          variant="ghost"
                          aria-label={t.tradePricing.inlineSave}
                          loading={isSavingRow}
                          disabled={isSavingRow}
                          onClick={() => void commitEdit(book)}
                          className="rounded-md bg-success-vivid px-2.5 text-white not-disabled:hover:bg-success-vivid/90"
                        >
                          <Check className="size-3.5" aria-hidden="true" />
                          {t.common.save}
                        </Button>
                        <Button
                          type="button"
                          size="xs"
                          variant="outline"
                          aria-label={t.tradePricing.inlineCancel}
                          disabled={isSavingRow}
                          onClick={() => setEditing(null)}
                          className="size-7 p-0"
                        >
                          <X className="size-3.5" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-start gap-1.5">
                        <div className="flex min-w-0 flex-col">
                          <div className="flex items-center gap-1.5">
                            <Link
                              href={detailHref}
                              className="truncate text-sm font-bold text-foreground hover:text-primary"
                            >
                              {displayName}
                            </Link>
                            {canManage ? (
                              <Button
                                type="button"
                                size="xs"
                                variant="ghost"
                                aria-label={t.tradePricing.inlineEditLabel}
                                title={t.tradePricing.inlineEditLabel}
                                onClick={() => startEdit(book)}
                                className="size-6 shrink-0 rounded-md p-0 text-muted-foreground not-disabled:hover:text-primary"
                              >
                                <Pencil className="size-3" aria-hidden="true" />
                              </Button>
                            ) : null}
                          </div>
                          {subtitle ? (
                            <span className="truncate text-caption text-muted-foreground">
                              {subtitle}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </TableCell>

                  {/* 3. Purpose */}
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-badge font-bold",
                        isSales
                          ? "border-kpi-new-line bg-kpi-new-surface text-kpi-new-text"
                          : "border-kpi-qualified-line bg-kpi-qualified-surface text-kpi-qualified-text",
                      )}
                    >
                      {tradeStatusLabel(t.tradeStatus, book.purpose, t.common.unknownCode)}
                    </span>
                  </TableCell>

                  {/* 4. Solid Dark Currency Pill */}
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-foreground px-2 py-0.5 text-badge font-bold text-background">
                      <IdentifierText>{book.currencyCode}</IdentifierText>
                    </span>
                  </TableCell>

                  {/* 5. Default Mapping */}
                  <TableCell>
                    {isDefault ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-kpi-rated-line bg-kpi-rated-surface px-2 py-0.5 text-badge font-bold text-kpi-rated-text">
                        <Star
                          className="size-3 fill-star-filled text-star-filled"
                          aria-hidden="true"
                        />
                        {t.tradePricing.isCompanyDefault}
                      </span>
                    ) : canManageDefaults && book.status === "ACTIVE" ? (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={isDefaultBusy}
                        onClick={() => void onSetDefault(book)}
                        className="h-6 px-2 text-caption text-muted-foreground not-disabled:hover:text-foreground"
                      >
                        {t.tradePricing.setAsCompanyDefault}
                      </Button>
                    ) : (
                      <span className="text-caption text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* 6. Published Version */}
                  <TableCell>
                    {publishedVer ? (
                      <Link
                        href={`${TENANT_ROUTES.trade}/price-book-versions/${publishedVer.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-kpi-qualified-line bg-kpi-qualified-surface px-2 py-0.5 text-badge font-bold text-kpi-qualified-text hover:underline"
                      >
                        <IdentifierText>{`v${publishedVer.versionNumber}`}</IdentifierText>
                        <span>·</span>
                        <span>
                          {tradeStatusLabel(
                            t.tradeStatus,
                            publishedVer.status,
                            t.common.unknownCode,
                          )}
                        </span>
                      </Link>
                    ) : retiredVer ? (
                      <Link
                        href={`${TENANT_ROUTES.trade}/price-book-versions/${retiredVer.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-line-card bg-count-zero-surface px-2 py-0.5 text-badge font-semibold text-count-zero-fg hover:underline"
                      >
                        <IdentifierText>{`v${retiredVer.versionNumber}`}</IdentifierText>
                        <span>·</span>
                        <span>
                          {tradeStatusLabel(t.tradeStatus, retiredVer.status, t.common.unknownCode)}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-caption text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* 7. Draft / Scheduled Version */}
                  <TableCell>
                    {pipelineVer ? (
                      <Link
                        href={`${TENANT_ROUTES.trade}/price-book-versions/${pipelineVer.id}`}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-badge font-bold hover:underline",
                          pipelineVer.status === "TESTED"
                            ? "border-kpi-qualified-line bg-kpi-qualified-surface text-kpi-qualified-text"
                            : pipelineVer.status === "SCHEDULED"
                              ? "border-kpi-new-line bg-kpi-new-surface text-kpi-new-text"
                              : "border-kpi-overdue-line bg-kpi-overdue-surface text-kpi-overdue-text",
                        )}
                      >
                        <IdentifierText>{`v${pipelineVer.versionNumber}`}</IdentifierText>
                        <span>
                          {tradeStatusLabel(
                            t.tradeStatus,
                            pipelineVer.status,
                            t.common.unknownCode,
                          )}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-caption text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* 8. Items / Promotions */}
                  <TableCell>
                    <div className="flex items-center gap-1 text-xs">
                      <span className="font-bold tabular-nums text-foreground">
                        {formatNumber(entriesCount, lang)}
                      </span>
                      <span className="text-muted-foreground">·</span>
                      <span
                        className={cn(
                          "font-semibold",
                          promosCount > 0 ? "text-kpi-qualified-text" : "text-muted-foreground",
                        )}
                      >
                        {promosCount > 0
                          ? promosCount === 1
                            ? t.tradePricing.boardPromoSingle
                            : formatTemplate(t.tradePricing.boardPromosCount, {
                                count: promosCount,
                              })
                          : t.tradePricing.cardNoPromos}
                      </span>
                    </div>
                  </TableCell>

                  {/* 9. Linked Accounts */}
                  <TableCell>
                    <span className="text-xs font-semibold text-foreground-secondary">
                      {accountsCount > 0
                        ? accountsCount === 1
                          ? t.tradePricing.boardAccountSingle
                          : formatTemplate(t.tradePricing.boardAccountsCount, {
                              count: accountsCount,
                            })
                        : isDefault
                          ? t.tradePricing.cardGeneralDefault
                          : "0"}
                    </span>
                  </TableCell>

                  {/* 10. Book Status */}
                  <TableCell>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-md border px-2 py-0.5 text-badge font-bold",
                        book.status === "ACTIVE"
                          ? "border-kpi-qualified-line bg-kpi-qualified-surface text-kpi-qualified-text"
                          : "border-line-card bg-count-zero-surface text-count-zero-fg",
                      )}
                    >
                      {tradeStatusLabel(t.tradeStatus, book.status, t.common.unknownCode)}
                    </span>
                  </TableCell>

                  {/* 11. Quick Actions */}
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        asChild
                        size="xs"
                        variant="outline"
                        className="border-kpi-new-line bg-kpi-new-surface px-2.5 font-bold text-kpi-new-text not-disabled:hover:bg-kpi-new-surface/80"
                      >
                        <Link href={detailHref}>{t.tradePricing.tableQuickOpen}</Link>
                      </Button>
                      <Button asChild size="xs" variant="outline" className="px-2">
                        <Link href={detailHref}>
                          <Plus className="size-3" aria-hidden="true" />
                          {t.tradePricing.newVersion}
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Pagination
        page={pageInfo}
        onPageChange={onPageChange}
        labels={{
          previous: t.common.previousPage,
          next: t.common.nextPage,
          summary: (from, to, total) =>
            formatTemplate(t.common.showingOf, { from, to, total }),
        }}
      />

      {/* Floating Dark Ocean Navy Bottom Bulk Bar (Mockup 03) */}
      {selectedIds.size > 0 ? (
        <div
          role="region"
          aria-label={formatTemplate(t.tradePricing.bulkSelectedCount, {
            count: selectedIds.size,
          })}
          className="fixed inset-x-0 bottom-5 z-(--z-sticky-header) mx-auto flex max-w-fit flex-wrap items-center gap-2.5 rounded-column border border-white/15 bg-navy-950 px-4 py-2.5 text-white shadow-lg"
        >
          <span className="inline-flex items-center rounded-full bg-gradient-primary px-3 py-1 text-xs font-bold text-white">
            {formatTemplate(t.tradePricing.bulkSelectedCount, {
              count: selectedIds.size,
            })}
          </span>

          <span className="h-4 w-px bg-white/15" aria-hidden="true" />

          {canManage ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => void onBulkStatus("ACTIVE")}
              className="border border-white/15 bg-white/10 text-white not-disabled:hover:bg-white/20"
            >
              <Power className="size-3.5" aria-hidden="true" />
              {t.tradePricing.bulkActivate}
            </Button>
          ) : null}

          <Button
            type="button"
            size="xs"
            variant="ghost"
            onClick={onExportCsv}
            className="border border-white/15 bg-white/10 text-white not-disabled:hover:bg-white/20"
          >
            <Download className="size-3.5" aria-hidden="true" />
            {t.tradePricing.bulkExportCsv}
          </Button>

          {canManage ? (
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => void onBulkStatus("INACTIVE")}
              className="border border-kpi-overdue-line/50 bg-destructive-vivid/25 text-white not-disabled:hover:bg-destructive-vivid/40"
            >
              {t.tradePricing.bulkDeactivate}
            </Button>
          ) : null}

          <Button
            type="button"
            size="xs"
            variant="ghost"
            aria-label={t.tradePricing.bulkClearSelection}
            onClick={onClearSelection}
            className="size-7 rounded-md p-0 text-white/75 not-disabled:hover:bg-white/15 not-disabled:hover:text-white"
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
