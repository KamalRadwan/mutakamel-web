import { describe, expect, it } from "vitest";
import { csvFileName, toCsv, type CsvColumn } from "./csv";

interface Row {
  name: string;
  detail: string;
}

const columns: ReadonlyArray<CsvColumn<Row>> = [
  { header: "Name", value: (row) => row.name },
  { header: "Detail", value: (row) => row.detail },
];

// Built rather than typed as escapes, so the bytes under test are unambiguous.
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const NUL = String.fromCharCode(0);
const BELL = String.fromCharCode(7);
const QUOTE = String.fromCharCode(34);
const CRLF = CR + LF;

describe("CSV serialisation", () => {
  it("quotes every field and terminates lines with CRLF", () => {
    expect(toCsv(columns, [{ name: "Acme", detail: "Riyadh" }])).toBe(
      `${QUOTE}Name${QUOTE},${QUOTE}Detail${QUOTE}${CRLF}${QUOTE}Acme${QUOTE},${QUOTE}Riyadh${QUOTE}${CRLF}`,
    );
  });

  it("writes a header-only file for an empty result set", () => {
    expect(toCsv(columns, [])).toBe(
      `${QUOTE}Name${QUOTE},${QUOTE}Detail${QUOTE}${CRLF}`,
    );
  });

  it("doubles embedded quotes and keeps commas and newlines inside the field", () => {
    const csv = toCsv(columns, [
      { name: `He said ${QUOTE}hi${QUOTE}`, detail: `a,b${LF}c` },
    ]);
    expect(csv).toContain(`${QUOTE}He said ${QUOTE}${QUOTE}hi${QUOTE}${QUOTE}${QUOTE}`);
    expect(csv).toContain(`${QUOTE}a,b${LF}c${QUOTE}`);
  });

  it("neutralises every formula lead character", () => {
    // Tenant data reaches these cells verbatim — a party display name is
    // whatever somebody typed — so this is not a theoretical case.
    for (const lead of ["=", "+", "-", "@", TAB, CR]) {
      const csv = toCsv(columns, [{ name: `${lead}cmd`, detail: "" }]);
      expect(csv).toContain(`${QUOTE}'${lead}cmd${QUOTE}`);
    }
  });

  it("leaves a value that merely contains those characters alone", () => {
    const csv = toCsv(columns, [{ name: "A-B", detail: "x@y" }]);
    expect(csv).toContain(`${QUOTE}A-B${QUOTE},${QUOTE}x@y${QUOTE}`);
  });

  it("strips unprintable control characters but keeps tab and newline", () => {
    const csv = toCsv(columns, [
      { name: `a${NUL}b${BELL}c`, detail: `x${TAB}y${LF}z` },
    ]);
    expect(csv).toContain(`${QUOTE}abc${QUOTE}`);
    expect(csv).toContain(`${QUOTE}x${TAB}y${LF}z${QUOTE}`);
  });

  it("preserves a UUID reference exactly — S11", () => {
    const id = "01900100-0000-7000-8000-000000000110";
    const csv = toCsv(
      [{ header: "Reference", value: (row: { id: string }) => row.id }],
      [{ id }],
    );
    expect(csv).toContain(`${QUOTE}${id}${QUOTE}`);
  });
});

describe("csvFileName", () => {
  it("stamps the instant and keeps the name filesystem-safe", () => {
    expect(csvFileName("mutakamel search", "2026-08-31T09:14:07.123Z")).toBe(
      "mutakamel-search-2026-08-31-09-14-07.csv",
    );
  });

  it("never produces an unnamed file", () => {
    expect(csvFileName("///", "2026-08-31T09:14:07.123Z")).toBe(
      "export-2026-08-31-09-14-07.csv",
    );
  });
});
