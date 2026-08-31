import { describe, expect, it } from "vitest";
import {
  buildCreateUomRequest,
  buildUpdateUomRequest,
  EMPTY_UOM_FORM,
  parseUomResponse,
  parseUomsResponse,
  toUomForm,
  uomsListPath,
  type Uom,
} from "./uom-contract";

const UOM_ID = "01890a5d-ac96-774b-bcce-b302099a8057";

const stored: Uom = {
  id: UOM_ID,
  code: "PCE",
  displayName: "Piece",
  localizedNames: { ar: "قطعة", en: "Piece", fr: "Pièce" },
  sourceEvidence: {
    sourceKind: "ISO_80000",
    reference: null,
    note: null,
    recordedBy: UOM_ID,
    recordedAt: "2026-08-31T09:00:00.000Z",
  },
  status: "ACTIVE",
  version: 3,
  updatedAt: "2026-08-31T09:00:00.000Z",
};

describe("buildCreateUomRequest", () => {
  it("uppercases the code and sends the required evidence", () => {
    const request = buildCreateUomRequest({
      ...EMPTY_UOM_FORM,
      code: "pce",
      displayName: " Piece ",
      nameEn: "Piece",
      sourceKind: "ISO_80000",
    });
    expect(request.code).toBe("PCE");
    expect(request.displayName).toBe("Piece");
    expect(request.sourceEvidence).toEqual({ sourceKind: "ISO_80000" });
  });

  it("rejects a code that does not start with a letter", () => {
    expect(() =>
      buildCreateUomRequest({ ...EMPTY_UOM_FORM, code: "1PCE", nameEn: "x", sourceKind: "k" }),
    ).toThrow("UOM_FORM_CODE");
  });

  it("requires at least one localized name", () => {
    expect(() =>
      buildCreateUomRequest({ ...EMPTY_UOM_FORM, code: "PCE", displayName: "Piece", sourceKind: "k" }),
    ).toThrow("UOM_FORM_NAMES");
  });

  it("requires a source kind", () => {
    expect(() =>
      buildCreateUomRequest({ ...EMPTY_UOM_FORM, code: "PCE", displayName: "Piece", nameEn: "Piece" }),
    ).toThrow("UOM_FORM_EVIDENCE");
  });
});

describe("buildUpdateUomRequest", () => {
  it("sends only what changed — every field is @ValidateIf, so null is a 400", () => {
    const request = buildUpdateUomRequest(stored, { ...toUomForm(stored), displayName: "Each" });
    expect(request).toEqual({ displayName: "Each" });
  });

  it("keeps a locale the two-field form cannot show", () => {
    // `localizedNames` is written wholesale, so a form that offers ar and en
    // would silently drop a stored fr without this merge.
    const request = buildUpdateUomRequest(stored, { ...toUomForm(stored), nameEn: "Each" });
    expect(request.localizedNames).toEqual({ ar: "قطعة", en: "Each", fr: "Pièce" });
  });

  it("emits nothing when nothing moved", () => {
    expect(buildUpdateUomRequest(stored, toUomForm(stored))).toEqual({});
  });
});

describe("uomsListPath", () => {
  it("drops a search term the DTO pattern would reject with a 400", () => {
    expect(uomsListPath(1, undefined, "PC E")).not.toContain("search");
    expect(uomsListPath(1, "ACTIVE", "PC")).toContain("search=PC");
  });
});

describe("parseUomResponse", () => {
  it("reads the projection the service actually returns", () => {
    const parsed = parseUomResponse({
      id: UOM_ID,
      code: "PCE",
      displayName: "Piece",
      localizedNames: { en: "Piece" },
      sourceEvidence: { sourceKind: "ISO_80000", recordedBy: UOM_ID },
      status: "ACTIVE",
      version: 1,
      updatedAt: "2026-08-31T09:00:00.000Z",
    });
    expect(parsed.sourceEvidence.sourceKind).toBe("ISO_80000");
    expect(parsed.sourceEvidence.reference).toBeNull();
  });

  it("refuses a row with version 0", () => {
    expect(() =>
      parseUomResponse({
        id: UOM_ID,
        code: "PCE",
        displayName: "Piece",
        localizedNames: { en: "Piece" },
        sourceEvidence: { sourceKind: "k" },
        status: "ACTIVE",
        version: 0,
        updatedAt: "2026-08-31T09:00:00.000Z",
      }),
    ).toThrow(/Invalid Trade UOM/u);
  });
});

describe("parseUomsResponse", () => {
  it("ignores the extra `source` literal beside the page fields", () => {
    const page = parseUomsResponse({
      items: [],
      total: 0,
      page: 1,
      limit: 50,
      source: "AUTHORIZED_TRADE_UOM_MASTER",
    });
    expect(page.items).toEqual([]);
    expect(page.totalPages).toBe(1);
  });
});
