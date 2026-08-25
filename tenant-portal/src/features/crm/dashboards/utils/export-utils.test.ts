import { describe, expect, it } from "vitest";
import { serializeCsv } from "./export-utils";

describe("serializeCsv", () => {
  it("neutralizes spreadsheet formulas in headers and string cells", () => {
    const csv = serializeCsv([
      {
        "=unsafe-header": "=HYPERLINK(\"https://attacker.invalid\")",
        plus: "+SUM(1,1)",
        minus: "-2+3",
        at: "@SUM(1,1)",
        spaced: "  =1+1",
        tabbed: "\t=1+1",
        numeric: -10,
      },
    ]);

    expect(csv).toContain(`"'=unsafe-header"`);
    expect(csv).toContain(`"'=HYPERLINK(""https://attacker.invalid"")"`);
    expect(csv).toContain(`"'+SUM(1,1)"`);
    expect(csv).toContain(`"'-2+3"`);
    expect(csv).toContain(`"'@SUM(1,1)"`);
    expect(csv).toContain(`"'  =1+1"`);
    expect(csv).toContain(`"'\t=1+1"`);
    expect(csv).toContain(`"-10"`);
  });

  it("preserves zero, false, quotes, and empty values", () => {
    expect(serializeCsv([{ zero: 0, disabled: false, quote: 'a"b', empty: null }]))
      .toBe('"zero","disabled","quote","empty"\n"0","false","a""b",""');
  });

  it("returns an empty document for an empty dataset", () => {
    expect(serializeCsv([])).toBe("");
  });
});
