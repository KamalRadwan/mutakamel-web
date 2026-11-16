// @vitest-environment jsdom

import { Suspense, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import PriceBookDetailPage from "./page";

vi.mock("@/hooks/useUnsavedChangesGuard", () => ({ useUnsavedChangesGuard: () => ({ isDiscardOpen: mocks.guardOpen, requestDiscard: (action: () => void) => action(), confirmDiscard: vi.fn(), cancelDiscard: vi.fn() }) }));
const mocks = vi.hoisted(() => ({
  useDetail: vi.fn(),
  lang: "en" as "en" | "ar",
  guardOpen: false,
}));

vi.mock("./hooks/usePriceBookDetail", () => ({ usePriceBookDetail: mocks.useDetail }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: { en, ar }[mocks.lang], lang: mocks.lang }),
}));
vi.mock("@/i18n/useLanguage", () => ({
  useDictionary: () => ({ en, ar }[mocks.lang]),
  useLanguage: () => mocks.lang,
  useDirection: () => (mocks.lang === "ar" ? "rtl" : "ltr"),
}));
vi.mock("@/context/AuthContext", () => ({
  useTenantAuth: () => ({ user: { id: "0195b5d0-0000-7000-8000-000000000099", permissions: [] }, status: "AUTHENTICATED" }),
}));
vi.mock("@/design-system", async (original) => {
  const actual = await original<typeof import("@/design-system")>();
  return {
    ...actual,
    DetailHeader: ({
      title,
      primaryAction,
      secondaryActions,
    }: {
      title: string;
      primaryAction?: { label: string; onClick: () => void; disabled?: boolean };
      secondaryActions?: ReactNode;
    }) => (
      <header>
        <h1>{title}</h1>
        {primaryAction ? (
          <button type="button" disabled={primaryAction.disabled} onClick={primaryAction.onClick}>
            {primaryAction.label}
          </button>
        ) : null}
        {secondaryActions}
      </header>
    ),
  };
});

const BOOK_ID = "0195b5d0-1000-7000-8000-000000000001";
const V1_ID = "0195b5d0-1000-7000-8000-000000000011";
const V2_ID = "0195b5d0-1000-7000-8000-000000000012";
const ITEM_ID = "0195b5d0-1000-7000-8000-000000000021";
const UOM_ID = "0195b5d0-1000-7000-8000-000000000022";
const params = Promise.resolve({ id: BOOK_ID });

afterEach(() => { cleanup(); mocks.guardOpen = false; });

function buildMockState(overrides: Record<string, unknown> = {}) {
  const t = { en, ar }[mocks.lang];
  const v1 = {
    id: V1_ID, version: 1, versionNumber: 1, status: "PUBLISHED" as const,
    effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveTo: null, supersededAt: null,
    checksum: "a".repeat(64), entryCount: 1, promotionCount: 0,
  };
  const v2 = {
    id: V2_ID, version: 2, versionNumber: 2, status: "DRAFT" as const,
    effectiveFrom: "2026-12-01T00:00:00.000Z", effectiveTo: null, supersededAt: null,
    checksum: "b".repeat(64), entryCount: 1, promotionCount: 0,
  };
  const versionDetail = {
    book: { id: BOOK_ID, code: "WHOLE-SAR", nameEn: "Wholesale SAR", nameAr: "جملة ريال", purpose: "SALES" as const, currencyCode: "SAR", currencyDecimalPlaces: 2 },
    version: { ...v2, createdByUserId: "0195b5d0-0000-7000-8000-000000000055" },
    entries: [{ id: "e1", itemId: ITEM_ID, uomId: UOM_ID, currencyCode: "SAR", minimumQuantity: "1", maximumQuantity: null, unitPrice: "150.00", minimumAllowedPrice: "120.00", standardCost: "100.00", priority: 100 }],
    promotions: [],
    latestTestEvidence: null,
    canViewCost: true,
    soloOwnerGovernanceEligible: false,
  };
  return {
    t, lang: mocks.lang,
    user: { id: "0195b5d0-0000-7000-8000-000000000099", displayName: "Checker", email: "c@x.io" },
    scope: { isResolved: true, headers: {} },
    companyId: "0195b5d0-9999-7000-8000-000000000001",
    isOffline: false, validId: true,
    canRead: true, canManage: true, canManageDefaults: true, canPublishOrRetire: true,
    detail: {
      book: {
        id: BOOK_ID, version: 1, code: "WHOLE-SAR", nameEn: "Wholesale SAR", nameAr: "جملة ريال",
        description: null, purpose: "SALES" as const, currencyCode: "SAR", currencyDecimalPlaces: 2,
        status: "ACTIVE" as const, isCompanyDefault: true,
      },
      companyDefaultMapping: { id: "m1", version: 1, purpose: "SALES" as const, currencyCode: "SAR", priceBookId: BOOK_ID },
      versions: [v1, v2],
      linkedAccounts: [],
      activeLocksCount: 2,
      auditTrail: [],
    },
    isLoading: false, queryError: null, isNotFound: false, isDenied: false, isBusy: false,
    bookAmbiguous: null, bookPending: null, actionError: null, clearActionError: vi.fn(),
    hasEffectiveVersionNow: true, selectedVersion: v2, selectVersion: vi.fn(),
    reference: { data: { canViewCost: true, items: [{ id: ITEM_ID, code: "SKU-1", nameEn: "Item 1", nameAr: "صنف ١", isSalesEnabled: true, isPurchaseEnabled: true }], uoms: [{ id: UOM_ID, code: "EA", nameEn: "Each", nameAr: "قطعة" }], branches: [], channels: [], accounts: [], currencies: [] }, books: [], channelBranchIdsByChannel: new Map(), error: null, reload: vi.fn() },
    versionWorkspace: {
      detail: versionDetail,
      draft: {
        effectiveFrom: "2026-12-01T00:00", effectiveTo: "", notes: "",
        entries: [{ key: "r1", itemId: ITEM_ID, uomId: UOM_ID, currencyCode: "SAR", minimumQuantity: "1", maximumQuantity: "", unitPrice: "150.00", minimumAllowedPrice: "120.00", priority: "100" }],
        promotions: [],
      },
      setDraft: vi.fn(), isEditableStatus: true, canManage: true, canTest: true, canPublish: false,
      canPublishGrant: true, canRetire: false, canDeleteDraft: true, isDirty: false, pending: null,
      isMakerSameAsActor: false, soloEligible: false, savedEvidenceMatchesChecksum: false,
      publishDisabledReasons: [], conflictReport: null, testReport: null, diffResult: null,
      isDiffLoading: false, isLoading: false, error: null, ambiguous: null, replayNotice: null,
      staleConflict: null, supersedesVersionId: "", setSupersedesVersionId: vi.fn(),
      soloOwnerAttestation: false, setSoloOwnerAttestation: vi.fn(), approvalNotes: "", setApprovalNotes: vi.fn(),
      saveDraft: vi.fn(), discardChanges: vi.fn(), test: vi.fn(), publish: vi.fn(),
      retire: vi.fn(), deleteDraft: vi.fn(), loadDiff: vi.fn(), reload: vi.fn(),
      dismissAmbiguous: vi.fn(), acceptServerReloadOnConflict: vi.fn(),
    },
    updateMetadata: vi.fn(), toggleCompanyDefault: vi.fn(), cloneOrSeedVersion: vi.fn(), reload: vi.fn(),
    ...overrides,
  };
}

async function renderPage(stateOverrides: Record<string, unknown> = {}) {
  mocks.useDetail.mockReturnValue(buildMockState(stateOverrides));
  await act(async () => {
    render(<Suspense fallback={null}><PriceBookDetailPage params={params} /></Suspense>);
  });
}

describe("PriceBookDetailPage unified workspace", () => {
  it("keeps the unknown-write leave warning accessible when the record becomes unavailable", async () => {
    mocks.lang = "en"; mocks.guardOpen = true;
    await renderPage({ isNotFound: true, detail: null, bookAmbiguous: {
      intentName: "updateBook", operation: en.tradePricing.editBookDetails,
      idempotencyKey: "0195b5d0-7777-7000-8000-000000000077", retry: vi.fn(),
    } });
    expect(screen.getByText(en.tradePricing.bookDetailNotFound)).toBeVisible();
    expect(screen.getByRole("alertdialog", { name: en.tradePricing.leaveUnknownTitle })).toBeVisible();
  });
  it("displays all significant decimal digits without splitting or floating-point conversion", async () => {
    mocks.lang = "en";
    const base = buildMockState();
    base.versionWorkspace.draft.entries[0]!.unitPrice = "9999999999999999.12345678";
    await renderPage({ versionWorkspace: base.versionWorkspace });
    const amount = screen.getByText("9,999,999,999,999,999.12345678");
    expect(amount.closest("td")).toHaveClass("whitespace-nowrap");
  });
  it("offers publication review for an authorized tested version before final approval is eligible", async () => {
    mocks.lang = "en";
    const base = buildMockState();
    const publish = vi.fn();
    await renderPage({
      selectedVersion: { ...base.selectedVersion, status: "TESTED" },
      versionWorkspace: { ...base.versionWorkspace, canPublishGrant: true, canPublish: false, publish,
        detail: { ...base.versionWorkspace.detail, version: { ...base.versionWorkspace.detail.version, status: "TESTED" } } },
    });
    const action = within(screen.getByRole("banner")).getByRole("button", { name: en.tradePricing.publishScheduleAction });
    expect(action).toBeEnabled();
    fireEvent.click(action);
    expect(screen.getByRole("dialog")).toBeVisible();
    expect(publish).not.toHaveBeenCalled();
  });
  it("shows timeline versions chronologically even when the API returns newest first", async () => {
    mocks.lang = "en";
    const base = buildMockState();
    await renderPage({ detail: { ...base.detail, versions: [...base.detail.versions].reverse() } });
    const rail = screen.getByRole("region", { name: en.tradePricing.versionTimelineTitle });
    const versions = within(rail).getAllByRole("button", { name: /^v\s*[12]/i });
    expect(versions[0]).toHaveTextContent("v1");
    expect(versions[1]).toHaveTextContent("v2");
  });
  it.each(["test", "publish"] as const)("retains the pending %s action instead of offering a concurrent new draft", async pending => {
    mocks.lang = "en";
    const base = buildMockState();
    const status = pending === "test" ? "DRAFT" : "TESTED";
    await renderPage({
      selectedVersion: { ...base.selectedVersion, status },
      versionWorkspace: { ...base.versionWorkspace, pending, canTest: false, canPublish: false,
        detail: { ...base.versionWorkspace.detail, version: { ...base.versionWorkspace.detail.version, status } } },
    });
    const label = pending === "test" ? en.tradePricing.runTest : en.tradePricing.publishScheduleAction;
    expect(within(screen.getByRole("banner")).getByRole("button", { name: label })).toBeDisabled();
    expect(screen.getByRole("button", { name: en.tradePricing.createNewDraft })).toBeDisabled();
  });
  it.each(["en", "ar"] as const)("renders NotFoundState without retry button and PermissionGate on 403 in %s", async (lang) => {
    mocks.lang = lang;
    const t = { en, ar }[lang];
    await renderPage({ isNotFound: true, detail: null });
    expect(screen.getByText(t.tradePricing.bookDetailNotFound)).toBeVisible();
    expect(screen.queryByRole("button", { name: t.common.retry })).not.toBeInTheDocument();

    cleanup();
    await renderPage({ isDenied: true, queryError: { status: 403, message: "Denied" }, detail: null });
    expect(screen.getByText(t.permissionGate.title)).toBeVisible();

    cleanup();
    await renderPage({ scope: { isResolved: false, headers: {} }, detail: null });
    expect(screen.getByText(t.tradePricing.selectCompanyTitle)).toBeVisible();
  });

  it.each(["en", "ar"] as const)("enforces cost redaction and inactive/no-effective-default banners in %s", async (lang) => {
    mocks.lang = lang;
    const t = { en, ar }[lang];
    const base = buildMockState();
    await renderPage({
      hasEffectiveVersionNow: false,
      detail: { ...base.detail, book: { ...base.detail.book, status: "INACTIVE" as const, isCompanyDefault: true } },
      versionWorkspace: { ...base.versionWorkspace, detail: { ...base.versionWorkspace.detail, canViewCost: false } },
    });
    expect(screen.getByText(t.tradePricing.inactiveBookBannerTitle)).toBeVisible();
    expect(screen.getByText(t.tradePricing.defaultNoEffectiveWarningTitle)).toBeVisible();
    expect(screen.getByText(t.tradePricing.costRedactedNotice)).toBeVisible();
    const costHeader = t.tradePricing.colCostCurrency.replace("{currency}", "SAR");
    expect(screen.queryByText(costHeader)).not.toBeInTheDocument();
  });

  it("handles empty book CTA and Create Draft modal source constraints (From version disabled, catalog caution, Empty draft)", async () => {
    mocks.lang = "en";
    const cloneSpy = vi.fn().mockResolvedValue(true);
    const base = buildMockState();
    await renderPage({
      detail: { ...base.detail, versions: [] },
      selectedVersion: null,
      cloneOrSeedVersion: cloneSpy,
    });
    expect(screen.getByText(en.tradePricing.emptyBookVersionsTitle)).toBeVisible();
    fireEvent.click(screen.getAllByRole("button", { name: en.tradePricing.createFirstDraft })[0]!);

    const fromVersionBtn = await screen.findByRole("button", { name: new RegExp(en.tradePricing.sourceFromVersionTitle) });
    expect(fromVersionBtn).toBeDisabled();
    expect(screen.getByText(en.tradePricing.catalogSeedZeroCaution)).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: new RegExp(en.tradePricing.sourceEmptyDraftTitle) }));
    fireEvent.click(screen.getByRole("button", { name: en.tradePricing.createNewDraft }));
    expect(cloneSpy).toHaveBeenCalledWith(expect.objectContaining({ sourceMode: "EMPTY" }));
  });

  it("guards dirty version switches, shows AmbiguousOutcomePanel with same-key retry, and omits Overwrite in ConflictDialog", async () => {
    mocks.lang = "en";
    const retrySpy = vi.fn();
    const selectSpy = vi.fn();
    const base = buildMockState();
    await renderPage({
      selectVersion: selectSpy,
      bookAmbiguous: {
        intentName: "updateBook",
        operation: en.tradePricing.editBookDetails,
        idempotencyKey: "0195b5d0-7777-7000-8000-000000000077",
        retry: retrySpy,
      },
      versionWorkspace: {
        ...base.versionWorkspace,
        isDirty: true,
        staleConflict: { retainedDraft: base.versionWorkspace.draft, latestServer: base.versionWorkspace.detail },
      },
    });

    expect(screen.getByText(en.crmDashboards.conflictTitle)).toBeVisible();
    expect(screen.queryByRole("button", { name: en.crmDashboards.conflictOverwrite })).not.toBeInTheDocument();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: en.common.cancel }));
    fireEvent.click(screen.getByText(en.tradePricing.ambiguousIdempotencyKeyLabel));
    expect(screen.getByText("0195b5d0-7777-7000-8000-000000000077")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: en.tradePricing.ambiguousRetrySameKeyAction }));
    expect(retrySpy).toHaveBeenCalledTimes(1);
  });
});
