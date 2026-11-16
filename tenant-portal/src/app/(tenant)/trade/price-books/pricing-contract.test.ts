import { describe, expect, it } from "vitest";
import {
  PRICE_BOOKS_PATH,
  PRICING_EVALUATE_PATH,
  POLICY_PUBLISH_PERMISSION,
  PRICING_MANAGE_PERMISSION,
  buildClonePriceBookVersionRequest,
  buildCreatePriceBookRequest,
  buildUpdatePriceBookRequest,
  companyDefaultPriceBookPath,
  companyDefaultPriceBookUpsertPath,
  parseCompanyDefaultPriceBook,
  parsePriceBookDetail,
  parsePriceBookKpis,
  parsePriceBookVersionDetail,
  parsePriceBookVersionDiff,
  parsePriceBookVersionTestReport,
  parsePriceBooksResponse,
  parsePricingDecision,
  priceBookVersionActionPath,
  priceBookVersionDiffPath,
  priceBookVersionPath,
  priceBookVersionsPath,
  priceBooksListPath,
} from "./pricing-contract";
import {
  buildCreateVersionRequest,
  buildUpdatePriceBookVersionRequest,
  detectVersionDraftConflicts,
  EMPTY_PRICE_ENTRY_DRAFT,
  EMPTY_PROMOTION_DRAFT,
} from "./version-draft";

const bookId = "01902001-3000-7000-8000-000000000001";
const versionId = "01902001-3000-7000-8000-000000000002";
const itemId = "01902001-3000-7000-8000-000000000003";
const uomId = "01902001-3000-7000-8000-000000000004";
const entryId = "01902001-3000-7000-8000-000000000005";
const decisionId = "01902001-3000-7000-8000-000000000006";
const branchId = "01902001-3000-7000-8000-000000000007";

describe("Trade pricing contract", () => {
  const testReport = {
    passed: false,
    entryCount: 2,
    promotionCount: 1,
    conflicts: [`${entryId}:${itemId}`],
    promotionConflicts: [`INVALID_BENEFIT:${decisionId}`],
  };

  it("preserves a failed test's entry and promotion diagnostics", () => {
    expect(parsePriceBookVersionTestReport(testReport)).toEqual(testReport);
  });

  it.each([true, false])("retains the explicit passed=%s validation outcome", (passed) => {
    expect(parsePriceBookVersionTestReport({
      passed, entryCount: passed ? 1 : 0, promotionCount: 0,
      conflicts: [], promotionConflicts: [],
    }).passed).toBe(passed);
  });

  it.each([
    { passed: "false" }, { passed: undefined }, { entryCount: -1 },
    { promotionCount: 1.5 }, { conflicts: null }, { conflicts: [42] },
    { promotionConflicts: undefined }, { promotionConflicts: [{}] },
  ])("rejects malformed test reports: %j", (invalidFields) => {
    expect(() => parsePriceBookVersionTestReport({ ...testReport, ...invalidFields }))
      .toThrow("Invalid Trade pricing response.");
  });

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
    expect(companyDefaultPriceBookPath("SALES", "sar")).toBe(
      "/api/tenant/trade/v1/configuration/company-default-price-books/SALES/SAR",
    );
    expect(companyDefaultPriceBookUpsertPath("PURCHASE", "usd")).toBe(
      "/api/tenant/trade/v1/configuration/company-default-price-books/PURCHASE/USD/upsert",
    );
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
    expect(request.promotions ?? []).toEqual([]);
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

  it("includes optional promotion scope selectors only when non-empty", () => {
    const request = buildCreateVersionRequest({
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      effectiveTo: "",
      entries: [
        { ...EMPTY_PRICE_ENTRY_DRAFT, itemId, uomId, currencyCode: "SAR", unitPrice: "15.00" },
      ],
      promotions: [
        {
          ...EMPTY_PROMOTION_DRAFT,
          code: "RAMADAN_10",
          name: "Ramadan Offer",
          benefitType: "PERCENTAGE",
          discountValue: "10",
          priority: "100",
          stackGroup: "DEFAULT",
          exclusive: false,
          branchId,
          minimumQuantity: "5",
          maximumQuantity: "50",
        },
      ],
    });
    expect(request.promotions?.[0]?.branchId).toBe(branchId);
    expect(request.promotions?.[0]?.minimumQuantity).toBe("5");
    expect(request.promotions?.[0]?.maximumQuantity).toBe("50");
    expect(request.promotions?.[0]).not.toHaveProperty("partyId");
  });

  it("detects pre-flight conflicts across overlapping quantity tiers, floor > unit, and currency mismatch", () => {
    const report = detectVersionDraftConflicts(
      {
        effectiveFrom: "2026-09-01T00:00:00.000Z",
        effectiveTo: "",
        entries: [
          {
            ...EMPTY_PRICE_ENTRY_DRAFT,
            itemId,
            uomId,
            currencyCode: "SAR",
            minimumQuantity: "1",
            maximumQuantity: "10",
            unitPrice: "100.00",
            minimumAllowedPrice: "120.00",
          },
          {
            ...EMPTY_PRICE_ENTRY_DRAFT,
            itemId,
            uomId,
            currencyCode: "USD",
            minimumQuantity: "5",
            maximumQuantity: "20",
            unitPrice: "90.00",
            minimumAllowedPrice: "80.00",
          },
        ],
        promotions: [
          {
            ...EMPTY_PROMOTION_DRAFT,
            code: "OVER_100",
            name: "Invalid Pct",
            benefitType: "PERCENTAGE",
            discountValue: "125",
            priority: "100",
            stackGroup: "DEFAULT",
            exclusive: false,
          },
        ],
      },
      "SAR",
    );
    expect(report.hasConflicts).toBe(true);
    expect(report.entryConflicts.filter(conflict => conflict.kind === "TIER_OVERLAP")).toHaveLength(0);
    expect(report.currencyMismatchIndices).toEqual([1]);
    expect(report.floorAboveUnitIndices).toEqual([0]);
    expect(report.percentageOver100PromotionIndices).toEqual([0]);
  });

  it("parses company default price book binding", () => {
    const binding = parseCompanyDefaultPriceBook({
      purpose: "SALES",
      currencyCode: "SAR",
      priceBookId: bookId,
      version: 2,
      updatedAt: "2026-09-01T00:00:00.000Z",
    });
    expect(binding.purpose).toBe("SALES");
    expect(binding.currencyCode).toBe("SAR");
    expect(binding.priceBookId).toBe(bookId);
    expect(binding.version).toBe(2);
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
            ...EMPTY_PROMOTION_DRAFT,
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
          versionCount: 1,
          versions: [
            {
              id: versionId,
              versionNumber: 1,
              status: "PUBLISHED",
              effectiveFrom: "2026-09-01T00:00:00.000Z",
              effectiveTo: null,
              supersededAt: "2026-10-18T12:00:00.000Z",
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
    expect(page.items[0].versions[0].supersededAt).toBe("2026-10-18T12:00:00.000Z");
    expect(page.items[0].versionCount).toBe(1);
  });

  it("retains the full count while parsing only five version summaries", () => {
    const versions = Array.from({ length: 5 }, (_, index) => ({
      id: versionId, versionNumber: 12 - index, status: "PUBLISHED",
      effectiveFrom: "2026-09-01T00:00:00.000Z", effectiveTo: null, version: 1,
    }));
    const book = {
      id: bookId, code: "RETAIL", purpose: "SALES", currencyCode: "SAR",
      status: "ACTIVE", version: 2, versionCount: 12, versions,
    };
    const parse = (item: unknown) => parsePriceBooksResponse({ items: [item], total: 1, page: 1, limit: 25 });
    expect(parse(book).items[0]).toMatchObject({ versionCount: 12, versions });
    expect(parse({ ...book, versionCount: 0, versions: [] }).items[0].versions).toEqual([]);
    for (const versionCount of [undefined, "12", -1, 1.5, 4]) {
      expect(() => parse({ ...book, versionCount })).toThrow("Invalid Trade pricing response.");
    }
    expect(() => parse({ ...book, versions: [...versions, versions[0]] }))
      .toThrow("Invalid Trade pricing response.");
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
        createdByUserId: itemId,
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
    expect(detail.version.createdByUserId).toBe(itemId);
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

  it("parses KPI aggregates, 360 book workspace details, version diffs, and empty draft updates", () => {
    const kpis = parsePriceBookKpis({
      total: 4,
      active: 3,
      inactive: 1,
      sales: 3,
      purchase: 1,
      publishedBooks: 2,
      scheduledBooks: 0,
      testedBooks: 1,
      draftOnlyBooks: 0,
      mappedDefaults: 2,
      distinctCurrencies: ["SAR", "USD"],
    });
    expect(kpis.publishedBooks).toBe(2);
    expect(kpis.distinctCurrencies).toEqual(["SAR", "USD"]);

    const workspace = parsePriceBookDetail({
      book: {
        id: bookId,
        code: "PB-WHOLESALE",
        name: "Wholesale SAR",
        localizedNames: { ar: "دفتر الجملة", en: "Wholesale SAR" },
        description: "B2B tier pricing",
        purpose: "SALES",
        currencyCode: "SAR",
        status: "ACTIVE",
        version: 1,
        versionCount: 1,
        isCompanyDefault: true,
        linkedAccountsCount: 1,
      },
      versions: [
        {
          id: versionId,
          versionNumber: 1,
          status: "PUBLISHED",
          effectiveFrom: "2026-09-01T00:00:00.000Z",
          effectiveTo: null,
          version: 2,
          checksum: "b".repeat(64),
          entryCount: 3,
          promotionCount: 1,
          latestTestPassed: true,
        },
      ],
      linkedAccounts: [
        {
          id: entryId,
          partyId: decisionId,
          displayName: "Mersany Telecom Corp",
          partyType: "ORGANIZATION",
          accountRole: "CUSTOMER",
          status: "ACTIVE",
        },
      ],
      activeLocksCount: 2,
      auditTrail: [],
    });
    expect(workspace.book.localizedNames?.ar).toBe("دفتر الجملة");
    expect(workspace.linkedAccounts[0]?.displayName).toBe("Mersany Telecom Corp");

    expect(priceBookVersionDiffPath(versionId, entryId)).toBe(
      `/api/tenant/trade/v1/price-book-versions/${versionId}/diff/${entryId}`,
    );
    const diff = parsePriceBookVersionDiff({
      currencyCode: "SAR",
      targetVersion: { id: versionId, priceBookId: bookId, priceBookCode: "PB-WHOLESALE", versionNumber: 2, status: "DRAFT" },
      baselineVersion: { id: entryId, priceBookId: bookId, priceBookCode: "PB-WHOLESALE", versionNumber: 1, status: "PUBLISHED" },
      summary: { totalCompared: 2, added: 1, removed: 0, increased: 1, decreased: 0, unchanged: 0, promotionsChanged: 0 },
      entries: [],
      promotions: [],
    });
    expect(diff.summary.added).toBe(1);

    const emptyDraftPatch = buildUpdatePriceBookVersionRequest({
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      effectiveTo: "",
      notes: "Work in progress",
      entries: [],
      promotions: [],
    });
    expect(emptyDraftPatch.entries).toEqual([]);
    expect(emptyDraftPatch.notes).toBe("Work in progress");

    const catalogSeedBody = buildClonePriceBookVersionRequest({
      sourceMode: "CATALOG",
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      adjustmentMode: "PERCENTAGE",
      adjustmentValue: "10",
      roundingMode: "NEAREST_1",
      copyPromotions: true,
    });
    expect(catalogSeedBody).toEqual({
      sourceMode: "SEED_FROM_CATALOG",
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      adjustmentMode: "PERCENTAGE",
      adjustmentValue: "10",
      roundingMode: "NEAREST_1",
    });
    expect(catalogSeedBody).not.toHaveProperty("copyPromotions");

    const versionCloneBody = buildClonePriceBookVersionRequest({
      sourceMode: "VERSION",
      sourceVersionId: versionId,
      effectiveFrom: "2026-09-01T00:00:00.000Z",
      copyPromotions: false,
    });
    expect(versionCloneBody).toMatchObject({
      sourceMode: "CLONE_VERSION",
      sourceVersionId: versionId,
      includePromotions: false,
    });

    const patchBookBody = buildUpdatePriceBookRequest({
      name: "Updated Wholesale",
      localizedNames: { ar: "دفتر محدث", en: "Updated Wholesale" },
      description: "Updated description",
      status: "ACTIVE",
    });
    expect(patchBookBody).toEqual({
      name: "Updated Wholesale",
      localizedNames: { ar: "دفتر محدث", en: "Updated Wholesale" },
      description: "Updated description",
      status: "ACTIVE",
    });
  });
});

