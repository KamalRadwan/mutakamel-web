"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Check, MoveHorizontal } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { formatLocaleNumber } from "@/i18n/locale";
import { cn } from "../../lib/cn";
import { focusRing } from "../../lib/variants";
import { Button } from "../../primitives/Button";
import { Checkbox } from "../../primitives/Checkbox";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../primitives/Table";
import { Pagination } from "../pagination/Pagination";
import { useDataTable } from "./useDataTable";
import { DataTableSkeleton } from "./DataTableSkeleton";
import { DataTableToolbar } from "./DataTableToolbar";
import type { ColumnDef, DataTableProps, DataTableSelection, ExplicitIdSelection } from "./types";

const ALIGN_CLASS = { start: "text-start", center: "text-center", end: "text-end" } as const;

interface VisibleRow<T> {
  id: string;
  original: T;
}

function priorityClass<T>(column: ColumnDef<T>, mode: NonNullable<DataTableProps<T>["responsiveMode"]>) {
  if (mode !== "priority-columns") return undefined;
  if (column.priority === "detail") return "hidden lg:table-cell";
  if (column.priority === "supporting") return "hidden sm:table-cell";
  return undefined;
}

function selectionIds<T>(selection: DataTableSelection<T> | undefined): readonly string[] {
  if (!selection) return [];
  return selection.kind === "EXPLICIT_IDS" ? selection.selectedIds : selection.excludedIds;
}

function selectionCount<T>(selection: DataTableSelection<T> | undefined): number {
  if (!selection) return 0;
  if (selection.kind === "EXPLICIT_IDS") return new Set(selection.selectedIds).size;
  return Math.max(0, selection.totalMatching - new Set(selection.excludedIds).size);
}

/**
 * Server-controlled data surface with stable background refresh, native sort
 * buttons, explicit selection scope, and a named horizontal-scroll region.
 * Mutation behavior deliberately stays outside this component.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const {
    labelEn,
    labelAr,
    columns,
    data,
    isLoading = false,
    isRefreshing = false,
    pagination,
    sort,
    getRowId,
    getRowLabel,
    responsiveMode = "horizontal-scroll",
    emptyState,
  } = props;
  const { lang } = useI18n();
  const { rows } = useDataTable({ data, getRowId });
  const tableLabel = lang === "ar" ? (labelAr ?? "جدول البيانات") : (labelEn ?? "Data table");
  const scrollHintId = useId();
  const busy = isLoading || isRefreshing;
  const [preservedRows, setPreservedRows] = useState(rows);
  const [announcement, setAnnouncement] = useState("");

  // A background request may briefly hand the component an empty array. Keep
  // the last rendered rows mounted until that request settles so scroll and
  // keyboard focus do not disappear.
  useEffect(() => {
    if ((rows.length === 0 && busy) || rows === preservedRows) return;
    let active = true;
    queueMicrotask(() => {
      if (active) setPreservedRows(rows);
    });
    return () => {
      active = false;
    };
  }, [busy, preservedRows, rows]);

  const visibleRows = busy && rows.length === 0 ? preservedRows : rows;
  const initialLoading = isLoading && visibleRows.length === 0;

  const legacySelection = useMemo<ExplicitIdSelection<T> | undefined>(() => {
    if (!props.onSelectionChange) return undefined;
    return {
      kind: "EXPLICIT_IDS",
      selectedIds: props.selectedIds,
      onSelectionChange: props.onSelectionChange,
    };
  }, [props.onSelectionChange, props.selectedIds]);
  const selection = props.selection ?? legacySelection;
  const selectable = Boolean(selection && getRowId);
  const selectedOrExcludedSet = useMemo(() => new Set(selectionIds(selection)), [selection]);
  const isEligible = useCallback(
    (row: VisibleRow<T>) => selection?.isRowSelectable?.(row.original) ?? true,
    [selection],
  );
  const isSelected = (row: VisibleRow<T>) => {
    if (!selection || !isEligible(row)) return false;
    return selection.kind === "EXPLICIT_IDS"
      ? selectedOrExcludedSet.has(row.id)
      : !selectedOrExcludedSet.has(row.id);
  };
  const visibleEligibleRows = visibleRows.filter(isEligible);
  const allSelected = visibleEligibleRows.length > 0 && visibleEligibleRows.every(isSelected);
  const someSelected = !allSelected && visibleEligibleRows.some(isSelected);

  const toggleAll = () => {
    if (!selection) return;
    if (selection.kind === "EXPLICIT_IDS") {
      const next = new Set(selection.selectedIds);
      for (const row of visibleEligibleRows) {
        if (allSelected) next.delete(row.id);
        else next.add(row.id);
      }
      selection.onSelectionChange(Array.from(next));
      return;
    }

    const next = new Set(selection.excludedIds);
    for (const row of visibleEligibleRows) {
      if (allSelected) next.add(row.id);
      else next.delete(row.id);
    }
    selection.onExcludedIdsChange(Array.from(next));
  };

  const toggleRow = (row: VisibleRow<T>) => {
    if (!selection || !isEligible(row)) return;
    if (selection.kind === "EXPLICIT_IDS") {
      const next = new Set(selection.selectedIds);
      if (next.has(row.id)) next.delete(row.id);
      else next.add(row.id);
      selection.onSelectionChange(Array.from(next));
      return;
    }

    const next = new Set(selection.excludedIds);
    if (next.has(row.id)) next.delete(row.id);
    else next.add(row.id);
    selection.onExcludedIdsChange(Array.from(next));
  };

  const handleSort = (column: ColumnDef<T>) => {
    if (!sort) return;
    const nextDir = sort.sortBy === column.key && sort.sortDir === "ASC" ? "DESC" : "ASC";
    sort.onSortChange(column.key, nextDir);
    const columnLabel = lang === "ar" ? column.headerAr : column.headerEn;
    setAnnouncement(
      lang === "ar"
        ? `تم ترتيب ${columnLabel} ${nextDir === "ASC" ? "تصاعدياً" : "تنازلياً"}`
        : `${columnLabel} sorted ${nextDir === "ASC" ? "ascending" : "descending"}`,
    );
  };

  const previousRefresh = useRef({ busy: false, totalItems: pagination.totalItems });
  useEffect(() => {
    const previous = previousRefresh.current;
    if (busy && !previous.busy) {
      setAnnouncement(lang === "ar" ? `جارٍ تحديث ${tableLabel}` : `Refreshing ${tableLabel}`);
      previousRefresh.current = { busy: true, totalItems: previous.totalItems };
      return;
    } else if (!busy && previous.busy) {
      const countChanged = previous.totalItems !== pagination.totalItems;
      setAnnouncement(
        lang === "ar"
          ? countChanged
            ? `اكتمل التحديث. ${formatLocaleNumber(lang, pagination.totalItems)} نتيجة`
            : "اكتمل تحديث البيانات"
          : countChanged
            ? `Refresh complete. ${formatLocaleNumber(lang, pagination.totalItems)} results`
            : "Data refresh complete",
      );
    }
    if (!busy) previousRefresh.current = { busy: false, totalItems: pagination.totalItems };
  }, [busy, lang, pagination.totalItems, tableLabel]);

  const previousRows = useRef<{
    page: number;
    queryFingerprint?: string;
    ids: Set<string>;
  } | null>(null);
  useEffect(() => {
    if (!selection || busy) return;

    const currentIds = new Set(rows.map((row) => row.id));
    const currentEligibleIds = new Set(rows.filter(isEligible).map((row) => row.id));
    const previous = previousRows.current;
    const queryChanged = Boolean(
      previous?.queryFingerprint &&
        selection.queryFingerprint &&
        previous.queryFingerprint !== selection.queryFingerprint,
    );
    let dropped = 0;

    if (queryChanged) {
      dropped = selectionCount(selection);
      if (selection.kind === "EXPLICIT_IDS") selection.onSelectionChange([]);
      else selection.onClearSelection();
    } else if (selection.kind === "EXPLICIT_IDS") {
      const next = new Set(selection.selectedIds);
      for (const id of selection.selectedIds) {
        const disappearedFromSamePage = Boolean(
          previous?.page === pagination.page && previous.ids.has(id) && !currentIds.has(id),
        );
        const nowIneligible = currentIds.has(id) && !currentEligibleIds.has(id);
        if (disappearedFromSamePage || nowIneligible) {
          next.delete(id);
          dropped += 1;
        }
      }
      if (dropped > 0) selection.onSelectionChange(Array.from(next));
    } else {
      const next = new Set(selection.excludedIds);
      for (const row of rows) {
        if (!currentEligibleIds.has(row.id) && !next.has(row.id)) {
          next.add(row.id);
          dropped += 1;
        }
      }
      if (dropped > 0) selection.onExcludedIdsChange(Array.from(next));
    }

    if (dropped > 0) {
      setAnnouncement(
        lang === "ar"
          ? `تمت إزالة ${dropped} من العناصر المحددة لأنها لم تعد متاحة لهذا الإجراء`
          : dropped === 1
            ? "1 selected item was removed because it is no longer available for this action"
            : `${dropped} selected items were removed because they are no longer available for this action`,
      );
    }

    previousRows.current = {
      page: pagination.page,
      queryFingerprint: selection.queryFingerprint,
      ids: currentIds,
    };
  }, [busy, isEligible, lang, pagination.page, rows, selection]);

  const clearSelection = () => {
    if (!selection) return;
    if (selection.kind === "EXPLICIT_IDS") selection.onSelectionChange([]);
    else selection.onClearSelection();
    setAnnouncement(lang === "ar" ? "تم إلغاء التحديد" : "Selection cleared");
  };

  const rowLabel = (row: VisibleRow<T>) => getRowLabel?.(row.original) ?? row.id;

  const emptyContent = emptyState ? (
    <div className="flex flex-col items-center gap-1.5">
      <p className="text-sm font-medium text-foreground">
        {lang === "ar" ? emptyState.titleAr : emptyState.titleEn}
      </p>
      {(emptyState.descriptionAr || emptyState.descriptionEn) && (
        <p className="text-sm text-muted-foreground">
          {lang === "ar" ? emptyState.descriptionAr : emptyState.descriptionEn}
        </p>
      )}
      {emptyState.action}
    </div>
  ) : (
    <p className="text-sm text-muted-foreground">{lang === "ar" ? "لا توجد بيانات" : "No data"}</p>
  );

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-card-foreground">
      <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      {selectable && (
        <DataTableToolbar
          selectedCount={selectionCount(selection)}
          scope={selection?.kind ?? "EXPLICIT_IDS"}
          onClearSelection={clearSelection}
          actions={selection?.actions}
        />
      )}
      {responsiveMode === "horizontal-scroll" && (
        <p id={scrollHintId} className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2 text-xs text-muted-foreground">
          <MoveHorizontal className="size-4 shrink-0" aria-hidden="true" />
          {lang === "ar"
            ? "مرّر أفقياً لعرض جميع الأعمدة"
            : "Scroll horizontally to view all columns"}
        </p>
      )}

      <div
        role="region"
        aria-label={tableLabel}
        aria-describedby={responsiveMode === "horizontal-scroll" ? scrollHintId : undefined}
        aria-busy={busy || undefined}
        tabIndex={responsiveMode === "horizontal-scroll" ? 0 : undefined}
        className={cn(
          "relative w-full",
          responsiveMode === "horizontal-scroll" && "overflow-x-auto overscroll-x-contain",
          responsiveMode === "horizontal-scroll" && focusRing,
        )}
      >
        {responsiveMode === "record-cards" && (
          <div className="divide-y divide-border md:hidden">
            {initialLoading ? (
              <div className="space-y-3 p-4" aria-hidden="true">
                {Array.from({ length: 3 }, (_, index) => (
                  <div key={index} className="h-28 animate-pulse rounded-md bg-muted motion-reduce:animate-none" />
                ))}
              </div>
            ) : visibleRows.length === 0 ? (
              <div className="px-4 py-10 text-center">{emptyContent}</div>
            ) : (
              visibleRows.map((row) => {
                const rowSelected = isSelected(row);
                return (
                  <article
                    key={row.id}
                    aria-label={rowLabel(row)}
                    data-state={rowSelected ? "selected" : undefined}
                    className="border-s-4 border-s-transparent p-4 data-[state=selected]:border-s-primary data-[state=selected]:bg-selected"
                  >
                    {selectable && (
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          {rowSelected && <Check className="size-4" aria-hidden="true" />}
                          {rowSelected ? (lang === "ar" ? "محدد" : "Selected") : rowLabel(row)}
                        </span>
                        <Checkbox
                          checked={rowSelected}
                          disabled={!isEligible(row)}
                          onCheckedChange={() => toggleRow(row)}
                          aria-label={
                            lang === "ar" ? `تحديد ${rowLabel(row)}` : `Select ${rowLabel(row)}`
                          }
                        />
                      </div>
                    )}
                    <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-x-3 gap-y-2 text-sm">
                      {columns.map((column) => (
                        <div key={column.key} className="contents">
                          <dt className="text-xs font-medium text-muted-foreground">
                            {lang === "ar" ? column.headerAr : column.headerEn}
                          </dt>
                          <dd className={cn("min-w-0 text-foreground", ALIGN_CLASS[column.align ?? "start"])}>
                            {column.cell(row.original)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                );
              })
            )}
          </div>
        )}

        <Table
          className={cn(
            "w-full caption-bottom text-sm",
            responsiveMode === "horizontal-scroll" && "min-w-max",
            responsiveMode === "record-cards" && "hidden md:table",
          )}
        >
          <TableHeader>
            <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
              {selectable && (
                <TableHead className="w-12 px-4 text-xs normal-case tracking-normal">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? "indeterminate" : false}
                    disabled={visibleEligibleRows.length === 0}
                    onCheckedChange={toggleAll}
                    aria-label={lang === "ar" ? "تحديد كل الصفوف الظاهرة" : "Select all visible rows"}
                  />
                </TableHead>
              )}
              {columns.map((column) => {
                const activeSort = sort?.sortBy === column.key;
                return (
                  <TableHead
                    key={column.key}
                    style={column.width ? { width: column.width } : undefined}
                    className={cn(
                      "text-xs normal-case tracking-normal",
                      ALIGN_CLASS[column.align ?? "start"],
                      priorityClass(column, responsiveMode),
                    )}
                    aria-sort={
                      column.sortable
                        ? activeSort
                          ? sort?.sortDir === "ASC"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                  >
                    {column.sortable ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        onClick={() => handleSort(column)}
                        className={cn(
                          "h-auto gap-1.5 rounded-sm px-1 py-1 text-start font-semibold text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {lang === "ar" ? column.headerAr : column.headerEn}
                        {activeSort ? (
                          sort?.sortDir === "ASC" ? (
                            <ArrowUp className="size-4" aria-hidden="true" />
                          ) : (
                            <ArrowDown className="size-4" aria-hidden="true" />
                          )
                        ) : (
                          <ArrowUpDown className="size-4 opacity-60" aria-hidden="true" />
                        )}
                      </Button>
                    ) : (
                      <span>{lang === "ar" ? column.headerAr : column.headerEn}</span>
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialLoading ? (
              <DataTableSkeleton columnCount={columns.length + (selectable ? 1 : 0)} />
            ) : visibleRows.length === 0 ? (
              <TableRow className="hover:bg-transparent dark:hover:bg-transparent">
                <TableCell colSpan={columns.length + (selectable ? 1 : 0)} className="py-10 text-center">
                  {emptyContent}
                </TableCell>
              </TableRow>
            ) : (
              visibleRows.map((row) => {
                const rowSelected = isSelected(row);
                return (
                  <TableRow
                    key={row.id}
                    aria-selected={selectable ? rowSelected : undefined}
                    data-state={rowSelected ? "selected" : undefined}
                    className="border-s-4 border-s-transparent data-[state=selected]:border-s-primary"
                  >
                    {selectable && (
                      <TableCell className="h-11 py-2.5">
                        <Checkbox
                          checked={rowSelected}
                          disabled={!isEligible(row)}
                          onCheckedChange={() => toggleRow(row)}
                          aria-label={
                            lang === "ar" ? `تحديد ${rowLabel(row)}` : `Select ${rowLabel(row)}`
                          }
                        />
                      </TableCell>
                    )}
                    {columns.map((column) => (
                      <TableCell
                        key={column.key}
                        className={cn(
                          "h-11 py-2.5",
                          ALIGN_CLASS[column.align ?? "start"],
                          priorityClass(column, responsiveMode),
                        )}
                      >
                        {column.cell(row.original)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {(visibleRows.length > 0 || pagination.totalItems > 0) && <Pagination {...pagination} />}
    </div>
  );
}
