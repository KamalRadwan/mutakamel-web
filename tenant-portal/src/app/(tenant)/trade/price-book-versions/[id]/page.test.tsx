// @vitest-environment jsdom

import { Suspense } from "react";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { ReactNode } from "react";
import type { PriceBookVersionTestReport } from "../../price-books/pricing-contract";
import PriceBookVersionPage from "./page";

const mocks = vi.hoisted(() => ({
  useVersion: vi.fn(), lang: "en" as "en" | "ar",
}));
vi.mock("./hooks/usePriceBookVersion", () => ({ usePriceBookVersion: mocks.useVersion }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { en, ar }[mocks.lang], lang: mocks.lang }),
}));
vi.mock("@/design-system", async (original) => {
  const actual = await original<typeof import("@/design-system")>();
  return { ...actual, DetailHeader: ({ secondaryActions }: { secondaryActions: ReactNode }) => <>{secondaryActions}</>, DataTable: () => null };
});

const versionId = "01902001-3000-7000-8000-000000000002";
const entryConflict = "01902001-3000-7000-8000-000000000003:01902001-3000-7000-8000-000000000004";
const promotionConflict = "INVALID_BENEFIT:01902001-3000-7000-8000-000000000005";
const params = Promise.resolve({ id: versionId });
const failedReport: PriceBookVersionTestReport = {
  passed: false, entryCount: 2, promotionCount: 1,
  conflicts: [entryConflict], promotionConflicts: [promotionConflict],
};

afterEach(cleanup);

async function renderReport(report: PriceBookVersionTestReport, publishDisabledReasons: string[] = []) {
  mocks.useVersion.mockReturnValue({
    lang: mocks.lang, canRead: true, canTest: true, canPublish: publishDisabledReasons.length === 0,
    publishDisabledReasons,
    isLoading: false, queryError: null, isNotFound: false, pending: null,
    testReport: report, test: vi.fn(), publish: vi.fn(), reload: vi.fn(),
    supersedesVersionId: "", setSupersedesVersionId: vi.fn(),
    detail: {
      book: { code: "RETAIL", purpose: "SALES", currencyCode: "SAR" },
      version: {
        id: versionId, versionNumber: 1, version: 1, status: "DRAFT",
        checksum: "a".repeat(64), effectiveFrom: "2026-10-17T00:00:00.000Z", effectiveTo: null,
      },
      entries: [], promotions: [], latestTestEvidence: null,
    },
  });
  // React's use(params) must finish its Suspense retry inside the render act.
  await act(async () => {
    render(<Suspense fallback={null}><PriceBookVersionPage params={params} /></Suspense>);
  });
}

describe("Price-book test report display", () => {
  it.each(["en", "ar"] as const)("labels the replacement field and explains historical pins in %s", async (lang) => {
    mocks.lang = lang;
    const t = { en, ar }[lang];
    await renderReport(failedReport);
    const input = await screen.findByRole("textbox", { name: t.tradeCommon.supersedesVersionId });
    expect(input).toHaveAccessibleDescription(t.tradeCommon.supersedesVersionHint);
  });
  it.each(["en", "ar"] as const)("associates visible disabled reasons with Publish in %s", async (lang) => {
    mocks.lang = lang;
    const t = { en, ar }[lang];
    const reasons = [t.tradePricing.publishTestedRequired, t.tradePricing.publishCheckerRequired];
    await renderReport(failedReport, reasons);
    const button = await screen.findByRole("button", { name: t.tradeCommon.publish });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription(reasons.join(" "));
    for (const reason of reasons) expect(screen.getByText(reason)).toBeVisible();
  });

  it.each(["en", "ar"] as const)("shows failure and both conflict groups in %s", async (lang) => {
    mocks.lang = lang;
    const t = { en, ar }[lang];
    await renderReport(failedReport);
    const report = await screen.findByRole("alert");
    expect(report).toHaveTextContent(t.tradePricing.testFailedShort);
    expect(within(report).getByRole("list", { name: t.tradePricing.entryConflicts }))
      .toHaveTextContent(entryConflict);
    expect(within(report).getByRole("list", { name: t.tradePricing.promotionConflicts }))
      .toHaveTextContent(promotionConflict);
    expect(within(report).queryByText(t.tradePricing.testPassedShort)).not.toBeInTheDocument();
  });

  it("explains an empty version's failure when there are no conflicts", async () => {
    mocks.lang = "en";
    await renderReport({ passed: false, entryCount: 0, promotionCount: 0, conflicts: [], promotionConflicts: [] });
    expect(await screen.findByRole("alert")).toHaveTextContent(en.tradePricing.noEntries);
  });

  it("shows a passed result without conflict lists for passed=true", async () => {
    mocks.lang = "en";
    await renderReport({ passed: true, entryCount: 1, promotionCount: 0, conflicts: [], promotionConflicts: [] });
    const report = await screen.findByRole("status");
    expect(report).toHaveTextContent(en.tradePricing.testPassedShort);
    expect(within(report).queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
