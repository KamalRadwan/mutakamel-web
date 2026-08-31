import { describe, expect, it } from "vitest";
import {
  PRICE_BOOKS_PATH,
  PRICING_EVALUATE_PATH,
  POLICY_PUBLISH_PERMISSION,
  PRICING_MANAGE_PERMISSION,
  buildCreatePriceBookRequest,
  parsePriceBookVersionDetail,
  parsePriceBooksResponse,
  parsePricingDecision,
  priceBookVersionActionPath,
  priceBookVersionPath,
  priceBookVersionsPath,
  priceBooksListPath,
} from "./pricing-contract";
import { buildCreateVersionRequest, EMPTY_PRICE_ENTRY_DRAFT } from "./version-draft";

const bookId = "01902001-3000-7000-8000-000000000001";
const versionId = "01902001-3000-7000-8000-000000000002";
const itemId = "01902001-3000-7000-8000-000000000003";
const uomId = "01902001-3000-7000-8000-000000000004";
const entryId = "01902001-3000-7000-8000-000000000005";
const decisionId = "01902001-3000-7000-8000-000000000006";

describe("Trade pricing contract", () => {
  it("builds every path from a canonical prefix", () => {
    expect(priceBooksListPath(1, "SALES")).toBe(
      `${PRICE_BOOKS_PATH}?page=1&limit=25&purpose=SALES`,
    );
    expect(priceBookVersionsPath(bookId)).toBe(`${PRICE_BOOKS_PATH}/${bookId}/versions`);
    expect(priceBookVersionPath(versionId)).toBe(
      `/api/tenant/trade/v1/price-book-versions/${versionId}`,
    );
    expect(priceBookVersionActionPath(versionId, "publish")).toBe(
      `/api/tenant/trade/v1/price-book-versions/${versionId}/publish`,
    );
    expect(PRICING_EVALUATE_PATH).toBe("/api/tenant/trade/v1/pricing/evaluate");
  });

  it("publishes with the Policy Studio grant, not the pricing one", () => {
    // Two of Trade's three publish actions sit behind trade.policy.publish.
    expect(POLICY_PUBLISH_PERMISSION).toBe("trade.policy.publish");
    expect(PRICING_MANAGE_PERMISSION).not.toBe(POLICY_PUBLISH_PERMISSION);
  });

  it("requires a three-letter currency on a book", () => {
    expect(
      buildCreatePriceBookRequest({ code: "RETAIL", purpose: "SALES", currencyCode: "sar" }),
    ).toEqual({ code: "RETAIL", purpose: "SALES", currencyCode: "SAR" });
    expect(() =>
      buildCreatePriceBookRequest({ code: "RETAIL", purpose: "SALES", currencyCode: "SARS" }),
    ).toThrow("PRICING_FORM_CURRENCY");
  });

  it("needs at least one entry on a version and defaults promotions to none", () => {
    const request = buildCreateVersionRequest({
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      effectiveTo: "",
      entries: [
        {
          ...EMPTY_PRICE_ENTRY_DRAFT,
          itemId,
          uomId,
          currencyCode: "sar",
          unitPrice: "10.50",
        },
      ],
      promotions: [],
    });
    expect(request.promotions).toEqual([]);
    // 10.50 keeps its trailing zero: it is a string, not a parsed number.
    expect(request.entries[0].unitPrice).toBe("10.50");
    expect(request.entries[0].currencyCode).toBe("SAR");
    // Optional decimals are omitted rather than sent as "".
    expect(request.entries[0]).not.toHaveProperty("maximumQuantity");
    expect(request).not.toHaveProperty("effectiveTo");

    expect(() =>
      buildCreateVersionRequest({
        effectiveFrom: "2026-09-01T00:00:00.000Z",
        effectiveTo: "",
        entries: [],
        promotions: [],
      }),
    ).toThrow("PRICING_FORM_ENTRIES");
  });

  it("refuses a promotion code the DTO pattern rejects", () => {
    expect(() =>
      buildCreateVersionRequest({
        effectiveFrom: "2026-09-01T00:00:00.000Z",
        effectiveTo: "",
        entries: [
          { ...EMPTY_PRICE_ENTRY_DRAFT, itemId, uomId, currencyCode: "SAR", unitPrice: "1" },
        ],
        promotions: [
          {
            code: "-BAD",
            name: "Bad",
            benefitType: "PERCENTAGE",
            discountValue: "5",
            priority: "100",
            stackGroup: "DEFAULT",
            exclusive: false,
          },
        ],
      }),
    ).toThrow("PRICING_FORM_PROMOTION_CODE");
  });

  it("reads a price book page as a flat offset page", () => {
    const page = parsePriceBooksResponse({
      items: [
        {
          id: bookId,
          code: "RETAIL",
          purpose: "SALES",
          currencyCode: "SAR",
          status: "ACTIVE",
          version: 2,
          versions: [
            {
              id: versionId,
              versionNumber: 1,
              status: "PUBLISHED",
              effectiveFrom: "2026-09-01T00:00:00.000Z",
              effectiveTo: null,
              version: 1,
            },
          ],
        },
      ],
      total: 1,
      page: 1,
      limit: 25,
    });
    expect(page.items[0].versions[0].status).toBe("PUBLISHED");
  });

  it("keeps every money field on a version detail an exact string", () => {
    const detail = parsePriceBookVersionDetail({
      book: {
        id: bookId,
        code: "RETAIL",
        purpose: "SALES",
        currencyCode: "SAR",
        status: "ACTIVE",
        version: 1,
      },
      version: {
        id: versionId,
        versionNumber: 1,
        status: "TESTED",
        effectiveFrom: "2026-09-01T00:00:00.000Z",
        effectiveTo: null,
        version: 3,
        checksum: "a".repeat(64),
      },
      entries: [
        {
          id: entryId,
          itemId,
          uomId,
          currencyCode: "SAR",
          minimumQuantity: "0",
          maximumQuantity: null,
          unitPrice: "10.50",
          minimumAllowedPrice: null,
          priority: 100,
        },
      ],
      promotions: [],
      latestTestEvidence: { passed: true, testedAt: "2026-08-31T00:00:00.000Z" },
    });
    expect(detail.entries[0].unitPrice).toBe("10.50");
    expect(detail.latestTestEvidence?.passed).toBe(true);
    expect(detail.version.version).toBe(3);
  });

  it("reads an evaluation and keeps the decision id that reaches the receipt", () => {
    const decision = parsePricingDecision({
      outcome: "ALLOW",
      unitPrice: "9.45",
      baselineUnitPrice: "10.50",
      currencyCode: "SAR",
      priceBookId: bookId,
      priceBookVersionId: versionId,
      minimumAllowedPrice: "8.00",
      decisionId,
      matchedPromotions: [{ code: "SUMMER", discountAmount: "1.05" }],
    });
    expect(decision.decisionId).toBe(decisionId);
    expect(decision.unitPrice).toBe("9.45");
    expect(decision.matchedPromotions[0].discountAmount).toBe("1.05");
  });
});
