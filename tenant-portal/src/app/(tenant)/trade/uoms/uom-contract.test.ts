import { describe, expect, it } from "vitest";
import {
  buildCreateUomRequest,
  buildUpdateUomRequest,
  catalogUomsPath,
  EMPTY_UOM_FORM,
  extractExtraLocales,
  parseCatalogUomsResponse,
  parseUomResponse,
  parseUomsResponse,
  toUomForm,
  uomsListPath,
  validateUomForm,
  type Uom,
} from "./uom-contract";

const UOM_ID = "01890a5d-ac96-774b-bcce-b302099a8057";

const stored: Uom = {
  id: UOM_ID,
  code: "PCE",
  displayName: "Piece",
  localizedNames: { ar: "قطعة", en: "Piece", fr: "Pièce" },
  status: "ACTIVE",
  version: 3,
  updatedAt: "2026-08-31T09:00:00.000Z",
};

describe("validateUomForm", () => {
  it("reports code, displayName, and localizedNames issues when empty on create", () => {
    expect(validateUomForm(EMPTY_UOM_FORM)).toEqual({
      code: true,
      displayName: true,
      localizedNames: true,
    });
  });

  it("skips code validation when codeReadOnly is true on edit", () => {
    expect(
      validateUomForm(
        { ...EMPTY_UOM_FORM, code: "", displayName: "Piece", nameEn: "Piece" },
        { codeReadOnly: true },
      ),
    ).toEqual({});
  });
});

describe("buildCreateUomRequest", () => {
  it("uppercases the code and trims the display name", () => {
    const request = buildCreateUomRequest({
      ...EMPTY_UOM_FORM,
      code: "pce",
      displayName: " Piece ",
      nameEn: "Piece",
    });
    expect(request.code).toBe("PCE");
    expect(request.displayName).toBe("Piece");
  });

  it("includes extraLocales when provided on create", () => {
    const request = buildCreateUomRequest({
      ...EMPTY_UOM_FORM,
      code: "ctn-24",
      displayName: "Carton of 24",
      nameEn: "Carton of 24",
      nameAr: "كرتونة 24",
      extraLocales: { fr: "Carton de 24", tr: "24 Koli" },
    });
    expect(request.localizedNames).toEqual({
      ar: "كرتونة 24",
      en: "Carton of 24",
      fr: "Carton de 24",
      tr: "24 Koli",
    });
  });

  it("rejects a code that does not start with a letter", () => {
    expect(() =>
      buildCreateUomRequest({ ...EMPTY_UOM_FORM, code: "1PCE", nameEn: "x" }),
    ).toThrow("UOM_FORM_CODE");
  });

  it("requires at least one localized name", () => {
    expect(() =>
      buildCreateUomRequest({
        ...EMPTY_UOM_FORM,
        code: "PCE",
        displayName: "Piece",
      }),
    ).toThrow("UOM_FORM_NAMES");
  });
});

describe("buildUpdateUomRequest", () => {
  it("sends only what changed — every field is @ValidateIf, so null is a 400", () => {
    const request = buildUpdateUomRequest(stored, {
      ...toUomForm(stored),
      displayName: "Each",
    });
    expect(request).toEqual({ displayName: "Each" });
  });

  it("keeps a locale the two-field form cannot show", () => {
    // `localizedNames` is written wholesale, so a form that offers ar and en
    // would silently drop a stored fr without this merge.
    const request = buildUpdateUomRequest(stored, {
      ...toUomForm(stored),
      nameEn: "Each",
    });
    expect(request.localizedNames).toEqual({
      ar: "قطعة",
      en: "Each",
      fr: "Pièce",
    });
  });

  it("updates extraLocales when explicitly edited", () => {
    const extras = extractExtraLocales(stored.localizedNames);
    expect(extras).toEqual({ fr: "Pièce" });
    const request = buildUpdateUomRequest(stored, {
      ...toUomForm(stored),
      extraLocales: { ...extras, de: "Stück" },
    });
    expect(request.localizedNames).toEqual({
      ar: "قطعة",
      en: "Piece",
      fr: "Pièce",
      de: "Stück",
    });
  });

  it("emits nothing when nothing moved", () => {
    expect(buildUpdateUomRequest(stored, toUomForm(stored))).toEqual({});
  });
});

describe("uomsListPath & catalogUomsPath", () => {
  it("drops a search term the DTO pattern would reject with a 400", () => {
    expect(uomsListPath(1, undefined, "PC E")).not.toContain("search");
    expect(uomsListPath(1, "ACTIVE", "PC")).toContain("search=PC");
  });

  it("builds the operating catalogue path with purpose", () => {
    expect(catalogUomsPath("SALES")).toContain("purpose=SALES");
  });
});

describe("parseUomResponse", () => {
  it("reads the projection the service actually returns", () => {
    const parsed = parseUomResponse({
      id: UOM_ID,
      code: "PCE",
      displayName: "Piece",
      localizedNames: { en: "Piece" },
      status: "ACTIVE",
      version: 1,
      updatedAt: "2026-08-31T09:00:00.000Z",
    });
    expect(parsed).toEqual({
      id: UOM_ID,
      code: "PCE",
      displayName: "Piece",
      localizedNames: { en: "Piece" },
      status: "ACTIVE",
      version: 1,
      updatedAt: "2026-08-31T09:00:00.000Z",
    });
  });

  it("refuses a row with version 0", () => {
    expect(() =>
      parseUomResponse({
        id: UOM_ID,
        code: "PCE",
        displayName: "Piece",
        localizedNames: { en: "Piece" },
        status: "ACTIVE",
        version: 0,
        updatedAt: "2026-08-31T09:00:00.000Z",
      }),
    ).toThrow(/Invalid Trade UOM/u);
  });
});

describe("parseUomsResponse & parseCatalogUomsResponse", () => {
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

  it("parses operating catalogue options including rich optional fields", () => {
    const options = parseCatalogUomsResponse({
      items: [
        {
          id: UOM_ID,
          code: "CTN",
          displayName: "Carton",
          localizedNames: { ar: "كرتونة", en: "Carton" },
          version: 2,
          isBaseUom: true,
          isDefaultSalesUom: true,
          isDefaultPurchaseUom: false,
          canSell: true,
          canPurchase: true,
          sourceItemCount: 14,
        },
      ],
      total: 1,
      page: 1,
      limit: 100,
    });
    expect(options).toHaveLength(1);
    expect(options[0]?.code).toBe("CTN");
    expect(options[0]?.sourceItemCount).toBe(14);
    expect(options[0]?.isDefaultSalesUom).toBe(true);
  });
});
