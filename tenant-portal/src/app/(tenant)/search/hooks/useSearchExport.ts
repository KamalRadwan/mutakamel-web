"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { csvFileName, downloadCsv, toCsv, type CsvColumn } from "@/lib/export/csv";
import { collectPages } from "@/lib/export/paged-export";
import {
  SEARCH_EXPORT_PAGE_SIZE,
  type SearchResultRow,
  type SearchSourceId,
} from "../search-contract";
import {
  fetchCrmSearchPage,
  fetchPartiesSearchPage,
  type SearchSourceState,
} from "./useGlobalSearch";

// Export — MASTER-PLAN 13.22. There is no backend export route (see the header
// of src/lib/export/csv.ts for how that was established), so the file is
// assembled here from rows the server returns.
//
// The two scopes are named separately on purpose. Exporting "the current page"
// and exporting "all 4,300 matching rows" are different promises, and one
// button labelled "Export" that quietly delivers the first is a lie.

/** Row ceiling for the whole walk, across every family. */
export const MAX_EXPORT_ROWS = 5000;
/** Request ceiling per family. `5000 / 100` — the two bounds agree. */
const MAX_EXPORT_PAGES = 50;

type ExportScope = "preview" | "all";

interface ExportRow extends SearchResultRow {
  source: SearchSourceId;
}

interface ExportProgress {
  scope: ExportScope;
  loaded: number;
  /** 0 while the first page is in flight — the total is not known before it. */
  expected: number;
}

export interface SearchExportState {
  isExporting: boolean;
  progress: ExportProgress | null;
  error: NormalizedApiError | null;
  /** Set when a bound stopped the walk, so the UI can say the file is partial. */
  truncatedAt: number | null;
  exportPreview: () => void;
  exportAll: () => void;
  cancel: () => void;
  dismissError: () => void;
}

interface SearchExportLabels {
  source: string;
  title: string;
  subtitle: string;
  reference: string;
  /** One label per family, already localised by the caller. */
  sourceNames: Record<SearchSourceId, string>;
}

/**
 * The CSV shape. `reference` carries the record id verbatim — S11: a UUID is
 * preserved exactly, never reformatted, because it is the only column that
 * survives a round trip back into the product.
 */
function exportColumns(labels: SearchExportLabels): ReadonlyArray<CsvColumn<ExportRow>> {
  return [
    { header: labels.source, value: (row) => labels.sourceNames[row.source] },
    { header: labels.title, value: (row) => row.title },
    { header: labels.subtitle, value: (row) => row.subtitle ?? "" },
    { header: labels.reference, value: (row) => row.id },
  ];
}

function readyRows(
  results: Record<SearchSourceId, SearchSourceState>,
  sourceIds: readonly SearchSourceId[],
): ExportRow[] {
  return sourceIds.flatMap((source) => {
    const state = results[source];
    return state.kind === "ready"
      ? state.page.items.map((item) => ({ ...item, source }))
      : [];
  });
}

interface SearchExportInput {
  term: string;
  branchId: string | null;
  sourceIds: readonly SearchSourceId[];
  results: Record<SearchSourceId, SearchSourceState>;
  labels: SearchExportLabels;
  fileNameBase: string;
}

export function useSearchExport({
  term,
  branchId,
  sourceIds,
  results,
  labels,
  fileNameBase,
}: SearchExportInput): SearchExportState {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [truncatedAt, setTruncatedAt] = useState<number | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const write = useCallback(
    (rows: ExportRow[]) => {
      const csv = toCsv(exportColumns(labels), rows);
      const written = downloadCsv(
        csvFileName(fileNameBase, new Date().toISOString()),
        csv,
      );
      // A browser that cannot be handed a file must say so. Status 0 is the
      // transport's "no HTTP response at all" — there was no request here
      // either, and inventing a status would be worse than reusing that one.
      if (!written) setError({ status: 0 });
    },
    [labels, fileNameBase],
  );

  const exportPreview = useCallback(() => {
    setError(null);
    setTruncatedAt(null);
    write(readyRows(results, sourceIds));
  }, [results, sourceIds, write]);

  const exportAll = useCallback(() => {
    if (isExporting) return;
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setTruncatedAt(null);
    setIsExporting(true);
    setProgress({ scope: "all", loaded: 0, expected: 0 });

    void (async () => {
      const rows: ExportRow[] = [];
      let truncated = false;
      try {
        for (const source of sourceIds) {
          if (results[source].kind !== "ready") continue;
          const remaining = MAX_EXPORT_ROWS - rows.length;
          if (remaining <= 0) {
            truncated = true;
            break;
          }
          const collected = await collectPages<SearchResultRow>({
            pageSize: SEARCH_EXPORT_PAGE_SIZE,
            maxRows: remaining,
            maxPages: MAX_EXPORT_PAGES,
            signal: controller.signal,
            fetchPage: (page, signal) =>
              source === "parties"
                ? fetchPartiesSearchPage(term, page, SEARCH_EXPORT_PAGE_SIZE, signal)
                : fetchCrmSearchPage(
                    source,
                    branchId as string,
                    term,
                    page,
                    SEARCH_EXPORT_PAGE_SIZE,
                    signal,
                  ),
            onProgress: ({ loaded, expected }) =>
              setProgress({
                scope: "all",
                loaded: rows.length + loaded,
                expected: rows.length + expected,
              }),
          });
          rows.push(...collected.rows.map((item) => ({ ...item, source })));
          truncated = truncated || collected.truncated;
        }
        if (controller.signal.aborted) return;
        setTruncatedAt(truncated ? rows.length : null);
        write(rows);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(normalizeApiError(caught));
      } finally {
        if (!controller.signal.aborted) {
          setIsExporting(false);
          setProgress(null);
        }
      }
    })();
  }, [branchId, isExporting, results, sourceIds, term, write]);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setIsExporting(false);
    setProgress(null);
  }, []);

  return {
    isExporting,
    progress,
    error,
    truncatedAt,
    exportPreview,
    exportAll,
    cancel,
    dismissError: () => setError(null),
  };
}

/** How many rows an "export everything" would actually write, bound included. */
export function exportRowEstimate(
  results: Record<SearchSourceId, SearchSourceState>,
  sourceIds: readonly SearchSourceId[],
): { total: number; capped: number } {
  const total = sourceIds.reduce((sum, id) => {
    const state = results[id];
    return state.kind === "ready" ? sum + state.page.total : sum;
  }, 0);
  return { total, capped: Math.min(total, MAX_EXPORT_ROWS) };
}

/** How many rows are on screen right now — the honest "current page" count. */
export function previewRowCount(
  results: Record<SearchSourceId, SearchSourceState>,
  sourceIds: readonly SearchSourceId[],
): number {
  return readyRows(results, sourceIds).length;
}
