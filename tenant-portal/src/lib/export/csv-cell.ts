/** Quoting preserves CSV structure; the apostrophe prevents spreadsheet formulas. */
export function escapeCsvCell(value: string | number | null | undefined): string {
  const text = String(value ?? "");
  const guarded = /^\s*[=+\-@\t\r\n]/u.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/gu, '""')}"`;
}
