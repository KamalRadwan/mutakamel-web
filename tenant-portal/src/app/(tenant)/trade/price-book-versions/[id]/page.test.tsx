// @vitest-environment jsdom

import { Suspense, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { PriceBookVersionTestReport } from "../../price-books/pricing-contract";
import { EMPTY_PROMOTION_DRAFT } from "../../price-books/version-draft";
import PriceBookVersionPage from "./page";

vi.mock("@/hooks/useUnsavedChangesGuard", () => ({ useUnsavedChangesGuard: () => ({ isDiscardOpen: false, requestDiscard: (action: () => void) => action(), confirmDiscard: vi.fn(), cancelDiscard: vi.fn() }) }));
const mocks = vi.hoisted(() => ({
  useVersion: vi.fn(),
  lang: "en" as "en" | "ar",
}));
vi.mock("./hooks/usePriceBookVersion", () => ({ usePriceBookVersion: mocks.useVersion }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { en, ar }[mocks.lang], lang: mocks.lang }),
}));
vi.mock("@/i18n/useLanguage", () => ({
  useDictionary: () => ({ en, ar }[mocks.lang]),
  useLanguage: () => mocks.lang,
  useDirection: () => (mocks.lang === "ar" ? "rtl" : "ltr"),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { id: "01902001-3000-7000-8000-000000000099", permissions: [] }, status: "AUTHENTICATED" }),
}));
vi.mock("@/design-system", async (original) => {
  const actual = await original<typeof import("@/design-system")>();
  return {
    ...actual,
    DetailHeader: ({
      primaryAction,
      secondaryActions,
    }: {
      primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
      secondaryActions: ReactNode;
    }) => (
      <>
        {primaryAction ? (
          <button type="button" disabled={primaryAction.disabled} onClick={primaryAction.onClick}>
            {primaryAction.label}
          </button>
        ) : null}
        {secondaryActions}
      </>
    ),
    DataTable: () => null,
  };
});

const versionId = "01902001-3000-7000-8000-000000000002";
const siblingId = "01902001-3000-7000-8000-000000000001";
const makerId = "01902001-3000-7000-8000-000000000050";
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

describe("Unified version studio governance & comparison", () => {
  async function renderStudio(overrides: Record<string, unknown> = {}) {
    mocks.useVersion.mockReturnValue({
      lang: mocks.lang,
      user: { id: makerId, displayName: "Maker User", email: "maker@x.io" },
      scope: { isResolved: true, headers: {} },
      canRead: true, canManage: true, canPublishGrant: true,
      canTest: true, canPublish: false, canRetire: false, canDeleteDraft: false,
      isEditableStatus: true, isDirty: false,
      isMakerSameAsActor: true, soloEligible: false, savedEvidenceMatchesChecksum: true,
      publishDisabledReasons: [{ en, ar }[mocks.lang].tradePricing.publishCheckerRequired],
      isLoading: false, queryError: null, isNotFound: false, pending: null,
      testReport: { passed: true, entryCount: 1, promotionCount: 1, conflicts: [], promotionConflicts: [] },
      supersedesVersionId: "", setSupersedesVersionId: vi.fn(),
      soloOwnerAttestation: false, setSoloOwnerAttestation: vi.fn(),
      approvalNotes: "", setApprovalNotes: vi.fn(),
      diffResult: {
        currencyCode: "SAR",
        baselineVersion: { id: siblingId, priceBookId: "01902001-3000-7000-8000-000000000010", priceBookCode: "RETAIL", versionNumber: 1, status: "PUBLISHED" },
        targetVersion: { id: versionId, priceBookId: "01902001-3000-7000-8000-000000000010", priceBookCode: "RETAIL", versionNumber: 2, status: "TESTED" },
        summary: { totalCompared: 0, added: 0, removed: 0, increased: 0, decreased: 0, unchanged: 0, promotionsChanged: 2 },
        entries: [], promotions: [],
      },
      isDiffLoading: false,
      reference: { data: null, channelBranchIdsByChannel: new Map(), error: null, reload: vi.fn() },
      detail: {
        book: {
          id: "01902001-3000-7000-8000-000000000010", code: "RETAIL", purpose: "SALES", currencyCode: "SAR",
          versions: [
            { id: siblingId, version: 1, versionNumber: 1, status: "PUBLISHED", effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null, checksum: "b".repeat(64) },
            { id: versionId, version: 2, versionNumber: 2, status: "TESTED", effectiveFrom: "2026-12-01T00:00:00.000Z", effectiveTo: null, checksum: "a".repeat(64) },
          ],
        },
        version: {
          id: versionId, versionNumber: 2, version: 2, status: "TESTED", createdByUserId: makerId,
          checksum: "a".repeat(64), effectiveFrom: "2026-12-01T00:00:00.000Z", effectiveTo: null,
        },
        entries: [], promotions: [],
        latestTestEvidence: { passed: true, testedAt: "2026-11-01T10:00:00.000Z", entryCount: 1, promotionCount: 1, contentHash: "a".repeat(64) },
        soloOwnerGovernanceEligible: false,
      },
      draft: {
        effectiveFrom: "2026-12-01T00:00", effectiveTo: "", notes: "", entries: [],
        promotions: [{ ...EMPTY_PROMOTION_DRAFT, key: "p1", code: "VIP-10", name: "VIP 10%", discountValue: "10" }],
      },
      setDraft: vi.fn(), test: vi.fn(), publish: vi.fn(), reload: vi.fn(), loadDiff: vi.fn(),
      ...overrides,
    });
    await act(async () => {
      render(<Suspense fallback={null}><PriceBookVersionPage params={params} /></Suspense>);
    });
  }

  it.each(["en", "ar"] as const)("enforces Maker-Checker block vs Solo-Owner unchecked attestation in Publish modal in %s", async (lang) => {
    mocks.lang = lang;
    const t = { en, ar }[lang];
    await renderStudio({ soloEligible: false, canPublish: false });
    expect(screen.getByText(t.tradePricing.selfApprovalBlockedBanner)).toBeVisible();

    cleanup();
    const attestSpy = vi.fn();
    await renderStudio({
      soloEligible: true,
      canPublish: true,
      publishDisabledReasons: [],
      soloOwnerAttestation: false,
      setSoloOwnerAttestation: attestSpy,
      detail: {
        book: { id: "01902001-3000-7000-8000-000000000010", code: "RETAIL", purpose: "SALES", currencyCode: "SAR", versions: [] },
        version: { id: versionId, versionNumber: 2, version: 2, status: "TESTED", createdByUserId: makerId, checksum: "a".repeat(64), effectiveFrom: "2026-12-01T00:00:00.000Z", effectiveTo: null },
        entries: [], promotions: [],
        latestTestEvidence: { passed: true, testedAt: "2026-11-01T10:00:00.000Z", entryCount: 1, promotionCount: 0, contentHash: "a".repeat(64) },
        soloOwnerGovernanceEligible: true,
      },
    });
    fireEvent.click(screen.getAllByRole("button", { name: t.tradePricing.publishScheduleAction })[0]!);
    const checkbox = await screen.findByRole("checkbox", { name: t.tradePricing.soloOwnerAttestationLabel });
    expect(checkbox).not.toBeChecked();
    fireEvent.click(checkbox);
    expect(attestSpy).toHaveBeenCalledWith(true);
  });

  it.each(["en", "ar"] as const)("renders Comparison tab price-only disclaimer and promotions-changed badge in %s", async (lang) => {
    mocks.lang = lang;
    const t = { en, ar }[lang];
    await renderStudio();
    const comparisonTab = screen.getByRole("tab", { name: t.tradePricing.workspaceTabComparison });
    fireEvent.mouseDown(comparisonTab, { button: 0 });
    fireEvent.keyDown(comparisonTab, { key: "Enter" });
    fireEvent.click(comparisonTab);
    expect(await screen.findByText(t.tradePricing.diffPriceOnlyDisclaimer)).toBeVisible();
    const promoBadgeText = t.tradePricing.diffPromosChangedBadge.replace(
      "{count}",
      new Intl.NumberFormat(lang === "ar" ? "ar-EG-u-nu-latn" : "en-US").format(2),
    );
    expect(screen.getByText(promoBadgeText)).toBeVisible();
  });
});
