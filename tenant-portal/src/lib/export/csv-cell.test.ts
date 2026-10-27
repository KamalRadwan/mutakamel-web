import { describe, expect, it } from "vitest";
import { escapeCsvCell } from "./csv-cell";

describe("CRM CSV cells", () => {
  it.each(["=1+1", "+cmd", "-123.456", "@SUM(1)", "\ttext", "\rtext", "\ntext"])(
    "neutralises %j even after whitespace",
    (value) => {
      for (const prefix of ["", "  ", "\uFEFF ", "\n "]) {
        expect(escapeCsvCell(prefix + value)).toBe(`"'${prefix}${value}"`);
      }
    },
  );

  it("quotes delimiters and preserves Arabic, newlines and exact amounts", () => {
    expect(escapeCsvCell('عميل, "جديد"\nالقاهرة')).toBe('"عميل, ""جديد""\nالقاهرة"');
    expect(escapeCsvCell("9007199254740991.123")).toBe('"9007199254740991.123"');
    expect(escapeCsvCell("A-B x@y")).toBe('"A-B x@y"');
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(0)).toBe('"0"');
  });
});
