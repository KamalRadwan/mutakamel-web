// Client-side CSV serialisation — MASTER-PLAN 13.22.
//
// There is NO backend export route. All 569 Gateway routes were checked
// against docs/generated/tenant-api-routes.json: the only path matching
// export/csv/xlsx/download is `GET /api/tenant/crm/v1/attachments/:id/download`,
// which streams a stored attachment. Every CSV/XLSX mention in core-app,
// crm-app and trade-app source is INGEST — attachment upload allow-lists, the
// static-data catalogue, and the trade import source reader. Nothing anywhere
// serialises list rows.
//
// So an export is assembled in the browser from rows the screen already holds,
// and the UI must say which rows those are. `lib/` because this is a pure
// helper with no domain meaning (file-architecture.md#where-a-new-thing-goes);
// it imports nothing upward.

/** One output column. `value` returns the cell already formatted for a human. */
export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string;
}

/**
 * Cells a spreadsheet would evaluate as a formula instead of reading as text.
 * `=`, `+`, `-` and `@` open a formula in Excel, Sheets and LibreOffice; a
 * leading tab or carriage return is the same thing with the trigger character
 * pushed one position right.
 *
 * Values arriving here are tenant data — a party display name is whatever
 * somebody typed — so this is not a theoretical case.
 */
const FORMULA_LEAD = /^[=+\-@\t\r]/u;

/**
 * Control characters no CSV reader can represent. Tab, newline and carriage
 * return are deliberately absent: quoting carries all three safely.
 */
const UNPRINTABLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu;

function escapeCell(value: string): string {
  const cleaned = value.replace(UNPRINTABLE, "");
  // A leading apostrophe is the portable neutraliser: Excel and Sheets both
  // treat the rest as text, and a plain-text reader shows one stray quote
  // rather than executing anything.
  const guarded = FORMULA_LEAD.test(cleaned) ? `'${cleaned}` : cleaned;
  return `"${guarded.replace(/"/gu, '""')}"`;
}

/**
 * RFC 4180 CSV. Every field is quoted rather than only the ones that need it —
 * unconditional quoting is what makes the formula guard above reliable, and it
 * removes a whole class of "the delimiter was in the data" bug.
 *
 * CRLF line endings, because RFC 4180 says so and because Excel on Windows is
 * the overwhelmingly likely reader.
 */
export function toCsv<T>(
  columns: ReadonlyArray<CsvColumn<T>>,
  rows: readonly T[],
): string {
  const lines = [columns.map((column) => escapeCell(column.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => escapeCell(column.value(row))).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

/**
 * The UTF-8 byte-order mark.
 *
 * Excel reads a BOM-less UTF-8 CSV as the system code page, which turns every
 * Arabic display name into mojibake. This portal is bilingual by contract, so
 * the BOM is not optional.
 */
const UTF8_BOM = "\uFEFF";

/** Windows-safe, and never empty: an unnamed download lands as `download`. */
export function csvFileName(base: string, isoInstant: string): string {
  const stem = base.replace(/[^A-Za-z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, "");
  const stamp = isoInstant.slice(0, 19).replace(/[:T]/gu, "-");
  return `${stem || "export"}-${stamp}.csv`;
}

/**
 * Hands the browser a file. Returns false when the environment has no
 * `URL.createObjectURL` — a caller then surfaces the failure rather than
 * silently doing nothing.
 */
export function downloadCsv(fileName: string, csv: string): boolean {
  if (
    typeof document === "undefined" ||
    typeof URL === "undefined" ||
    typeof URL.createObjectURL !== "function"
  ) {
    return false;
  }
  const blob = new Blob([UTF8_BOM, csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = fileName;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  // Revoked on the next task, not synchronously: Safari cancels an in-flight
  // download when its object URL is revoked in the same tick as the click.
  setTimeout(() => URL.revokeObjectURL(href), 0);
  return true;
}
