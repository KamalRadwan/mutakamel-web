// @vitest-environment jsdom
import { Suspense } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { peekLanguageSnapshot } from "@/i18n/dictionary-store";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import type { QuotationDetail } from "../quotation-contract";
import type { QuotationPricingRequest } from "../quotation-discount-contract";
import { parseQuotationPricingRequestMock } from "../hooks/quotation-edit.test-helpers";

const COMPANY_ID = "01890000-0000-7000-8000-000000000001";
const BRANCH_ID = "01890000-0000-7000-8000-000000000002";
const PARTY_ID = "01890000-0000-7000-8000-000000000003";
const QUOTE_ID = "01890000-0000-7000-8000-000000000010";
const REV_1_ID = "01890000-0000-7000-8000-000000000011";
const PDF_JOB_ID = "01890000-0000-7000-8000-000000000091";
const emptySearchParams = Promise.resolve({});
const ITEM_ID = "01890000-0000-7000-8000-000000000020";
const UOM_ID = "01890000-0000-7000-8000-000000000021";
const LINE_CLIENT_ID = "01890000-0000-7000-8000-000000000061";
const LIMIT_ID = "01890000-0000-7000-8000-000000000070";

const { auth, detailState, i18nState, tradeGetMock, tradePostMock, router, toast } = vi.hoisted(() => ({
  auth: {
    user: { id: "01890000-0000-7000-8000-000000000090", isTenantOwner: true } as {
      id: string;
      isTenantOwner?: boolean;
    } | null,
    realtimeAuthGeneration: "tenant:session-a:01890000-0000-7000-8000-000000000090" as string | null,
    readReadyProfileCommit: vi.fn(),
  },
  detailState: {
    document: null as QuotationDetail | null,
    isLoading: false,
    isMissing: false,
    loadError: null as { status?: number; code?: string } | null,
    canWrite: (() => true) as (permission?: string) => boolean,
    reload: vi.fn(async () => undefined),
  },
  i18nState: {
    lang: "en" as "en" | "ar",
  },
  tradeGetMock: vi.fn(),
  tradePostMock: vi.fn(),
  router: { push: vi.fn() },
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    errorFromApi: vi.fn(),
    outcomeFromApi: vi.fn(() => false),
  },
}));

const { fetchTemplates } = vi.hoisted(() => ({ fetchTemplates: vi.fn() }));
vi.mock("../../../core/templates/templates-api", () => ({ fetchTemplates }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => auth }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  useRouter: () => router,
}));
vi.mock("@/hooks/useTenantOrganizationOptions", () => ({
  useTenantOrganizationOptions: (kind: "company" | "branch") =>
    kind === "company"
      ? [{ value: COMPANY_ID, label: "Mersany HQ" }]
      : [{ value: BRANCH_ID, label: "Cairo Branch" }],
}));
vi.mock("../../useTradeScope", () => ({
  useTradeScope: () => ({
    companyIds: [COMPANY_ID],
    branchIds: [BRANCH_ID],
    channels: [],
    context: { companyId: COMPANY_ID, branchId: BRANCH_ID, channelId: undefined },
    contextLocked: false,
    setCompanyId: vi.fn(),
    setBranchId: vi.fn(),
    setChannelId: vi.fn(),
    registerContextGuard: vi.fn(() => () => undefined),
  }),
  useOptionalTradeScope: () => undefined,
}));
vi.mock("../../documents/components/TradeGate", () => ({
  TradeGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("../../documents/hooks/useTradeDocumentDetail", () => ({
  useTradeDocumentDetail: () => ({
    document: detailState.document,
    isLoading: detailState.isLoading,
    isMissing: detailState.isMissing,
    loadError: detailState.loadError,
    reload: detailState.reload,
    scope: {
      isResolved: true,
      headers: { [COMPANY_SCOPE_HEADER]: COMPANY_ID, [BRANCH_SCOPE_HEADER]: BRANCH_ID },
      canWrite: detailState.canWrite,
      userId: auth.user?.id ?? null,
    },
  }),
}));
vi.mock("../../trade-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../trade-api")>()),
  tradeGet: tradeGetMock,
  tradePost: tradePostMock,
}));
vi.mock("@/components/audit/RecordHistoryTab", () => ({
  RecordHistoryTab: () => <div data-testid="record-history-stub" />,
}));
vi.mock("../components/QuotationPdfWorkspace", () => ({
  QuotationPdfWorkspace: ({ reopenJobId }: { reopenJobId?: string }) => (
    <div data-testid="quotation-pdf-stub" data-reopen-job={reopenJobId} />
  ),
}));
vi.mock("@/design-system", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/design-system")>()),
  useToast: () => toast,
}));
vi.mock("@/i18n/I18nContext", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/i18n/I18nContext")>()),
  useI18n: () => {
    const snapshot = peekLanguageSnapshot(i18nState.lang);
    if (!snapshot) throw new Error(`tests/i18n.ts must preload ${i18nState.lang}`);
    return { t: snapshot.dictionary, lang: i18nState.lang, dir: i18nState.lang === "ar" ? "rtl" : "ltr" };
  },
}));

import QuotationDetailPage from "./page";

function reply(data: unknown) {
  return { data, headers: new Headers() };
}

function makeQuotation(overrides: Partial<QuotationDetail> = {}): QuotationDetail {
  return {
    id: QUOTE_ID,
    version: 2,
    companyId: COMPANY_ID,
    branchId: BRANCH_ID,
    channelId: null,
    partyId: PARTY_ID,
    crmCustomerProfileId: null,
    customerEligibilitySource: "ACTIVE_COMMERCIAL_ACCOUNT",
    contactPartyId: null,
    currencyCode: "EGP",
    businessDate: "2026-11-14",
    lifecycleStatus: "DRAFT",
    approvalStatus: "NOT_REQUIRED",
    fulfillmentStatus: "UNPLANNED",
    billingStatus: "NOT_BILLED",
    grandTotal: "9500.00",
    documentNumber: null,
    draftReference: "RFQ-ROUTE-1",
    partySnapshot: { displayName: "Delta Studio" },
    createdBy: null,
    createdAt: "2026-11-14T01:00:00.000Z",
    updatedAt: "2026-11-14T01:00:00.000Z",
    currentRevisionId: REV_1_ID,
    acceptedRevisionId: null,
    revisions: [
      {
        id: REV_1_ID,
        revisionNumber: 1,
        status: "DRAFT",
        validUntil: "2099-12-31",
        subtotal: "10000.00",
        discountTotal: "500.00",
        grandTotal: "9500.00",
        pricingMode: "DISCOUNT",
        discountSnapshot: {
          pricing: { mode: "DISCOUNT", scope: "DOCUMENT", type: "PERCENT", value: "5", reason: "Seasonal" },
          limitsSnapshot: { id: LIMIT_ID, version: 1, maxPercent: "20", allowFreeItems: false, reasonRequired: true },
          totals: { subtotal: "10000.00", discountTotal: "500.00", grandTotal: "9500.00", baseSubtotal: "10000.00", promotionSavings: "0" },
        },
        termsSnapshot: { paymentTermCode: "NET_30", incotermCode: "EXW", deliveryDays: 14, warrantyMonths: 12 },
        sentAt: null,
        acceptedAt: null,
        rejectedAt: null,
        priceLockExpiresAt: null,
      },
    ],
    currentLines: [
      {
        id: "01890000-0000-7000-8000-000000000031",
        clientLineId: LINE_CLIENT_ID,
        printLineNumber: 1,
        descriptionSnapshot: "Standing desk 160x80cm (v2)",
        quantity: "2.00000000",
        uomId: UOM_ID,
        unitPrice: "5000.00",
        discountTotal: "500.00",
        lineTotal: "9500.00",
        discountSnapshot: { itemId: ITEM_ID },
      },
    ],
    ...overrides,
  };
}

afterEach(cleanup);

describe("QuotationDetailPage (/trade/quotations/[id]) unified workspace routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18nState.lang = "en";
    detailState.isLoading = false;
    detailState.isMissing = false;
    detailState.loadError = null;
    detailState.canWrite = () => true;
    tradeGetMock.mockImplementation(async (path: string) => {
      if (path.includes("/quotations/discount-policy")) {
        return reply({
          canApply: true,
          hasApplyPermission: true,
          canManage: false,
          configured: true,
          limit: { id: LIMIT_ID, version: 1, maxPercent: "20", allowFreeItems: false, reasonRequired: true },
        });
      }
      if (path.includes("/quotations/contact-options")) {
        return reply({ partyType: "PERSON", items: [] });
      }
      if (path.includes("/uoms/catalogue")) {
        return reply({
          items: [{ id: UOM_ID, code: "EA", displayName: "Each", isBaseUom: true, canSell: true, canPurchase: true }],
          total: 1, page: 1, limit: 50,
        });
      }
      if (path.includes("/items/") && !path.includes("?")) {
        return reply({
          id: ITEM_ID,
          canonicalCode: "DESK-160",
          baseUomId: UOM_ID,
          localizedNames: { en: "Standing Desk 160cm" },
          quotationDescription: "Standing desk 160x80cm (v2)",
          status: "ACTIVE",
          image: null,
          companyProfile: {
            id: "01890000-0000-7000-8000-000000000022",
            version: 1,
            status: "ACTIVE",
            canSell: true,
            canPurchase: false,
            canPos: false,
            defaultSalesUomId: null,
            defaultPurchaseUomId: null,
          },
          branchProfile: {
            id: "01890000-0000-7000-8000-000000000023",
            version: 1,
            isAssorted: true,
          },
        });
      }
      return reply({ items: [], total: 0, page: 1, limit: 50 });
    });
    tradePostMock.mockImplementation(async (path: string, body: unknown) => {
      if (path.endsWith("/quotations/pricing-preview")) {
        return reply(parseQuotationPricingRequestMock(body as QuotationPricingRequest, LIMIT_ID));
      }
      return reply({});
    });
  });

  it("renders the shared editable workspace directly for DRAFT quotations when user can update", async () => {
    detailState.document = makeQuotation({ lifecycleStatus: "DRAFT" });
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <QuotationDetailPage params={Promise.resolve({ id: QUOTE_ID })} searchParams={emptySearchParams} />
        </Suspense>,
      );
    });

    expect(screen.getByTestId("quotation-workspace")).toBeTruthy();
    expect(screen.queryByTestId("quotation-readonly-body")).toBeNull();
    await waitFor(() => expect(tradePostMock).toHaveBeenCalled());
    expect(screen.getByDisplayValue("RFQ-ROUTE-1")).toBeTruthy();
  });

  it.each([
    { name: "Arabic authorized branch", lang: "ar", read: "allowed", manage: "current", reason: ["no_eligible_default_assignment"], link: true },
    { name: "English authorized branch", lang: "en", read: "allowed", manage: "current", reason: ["no_eligible_default_assignment"], link: true },
    { name: "local denial of templates.read", lang: "ar", read: "denied", manage: "current", reason: ["no_eligible_default_assignment"], link: false },
    { name: "current gallery policy denial", lang: "en", read: "policy", manage: "current", reason: ["no_eligible_default_assignment"], link: false },
    { name: "manage grant for another branch", lang: "ar", read: "allowed", manage: "other", reason: ["no_eligible_default_assignment"], link: false },
    { name: "read permission without manage", lang: "en", read: "allowed", manage: "none", reason: ["no_eligible_default_assignment"], link: false },
    { name: "legacy generic default refusal", lang: "en", read: "allowed", manage: "current", reason: undefined, link: false },
    { name: "incompatible immutable version", lang: "en", read: "allowed", manage: "current", reason: ["immutable_template_incompatible"], link: false },
    { name: "ambiguous default reason", lang: "en", read: "allowed", manage: "current", reason: ["no_eligible_default_assignment", "other"], link: false },
  ] as const)("keeps the Sales assignment action scoped for $name", async ({ lang, read, manage, reason, link }) => {
    i18nState.lang = lang;
    const { QuotationPdfWorkspace } = await vi.importActual<typeof import("../components/QuotationPdfWorkspace")>("../components/QuotationPdfWorkspace");
    const t = peekLanguageSnapshot(lang)!.dictionary;
    const copy = t.quotationPdf;
    const permissions = ["trade.quotations.read", ...(read !== "denied" ? ["templates.read"] : []),
      ...(manage !== "none" ? ["templates.assignments.manage"] : [])];
    const otherBranch = "01890000-0000-7000-8000-000000000099";
    const user = { ...auth.user!, isTenantOwner: false, permissions,
      permissionScopes: Object.fromEntries(permissions.map(permission => [permission, { tenantWide: false, companyIds: [],
        branchIds: [permission === "templates.assignments.manage" && manage === "other" ? otherBranch : BRANCH_ID] }])),
      accessibleBranchCompanies: [{ companyId: COMPANY_ID, branchId: BRANCH_ID }],
    };
    const originalUser = auth.user;
    auth.user = user;
    auth.readReadyProfileCommit.mockReturnValue({ user });
    sessionStorage.setItem("tenant_session_meta", JSON.stringify({ sessionId: "session-a", savedAt: Date.now(),
      expiresIn: 300, sessionExpiresIn: 300, tokenType: "Bearer", remember: false, authorizationVersion: 1, profileVersion: 1, authEventId: "fixture" }));
    const draftRow = { id: "01a1d354-8767-7c09-96ac-db0b5b51d1cb", code: "QA_SALES_AUTHORING_20261113_FLOW_AR", name: "Arabic Flow",
      currentPublishedVersion: null, documentType: "QUOTATION", outputChannel: "PRINT", layoutMode: "FLOW_DOCUMENT",
      locale: "ar-EG", lifecycleStatus: "ACTIVE" };
    fetchTemplates.mockReset().mockResolvedValue({ items: [draftRow], nextCursor: null });
    if (read === "policy") fetchTemplates.mockRejectedValue(new TenantApiClientError("Unavailable", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: { errorCode: "ACCESS_POLICY_BLOCKED" },
    }, "http"));
    const quote = makeQuotation({ lifecycleStatus: "SENT", documentNumber: "QT-FIXTURE" });
    quote.revisions = quote.revisions.map(revision => ({ ...revision, status: "SENT" }));
    const headers = { [COMPANY_SCOPE_HEADER]: COMPANY_ID, [BRANCH_SCOPE_HEADER]: BRANCH_ID };
    const renderPath = `/api/tenant/trade/v1/quotations/${QUOTE_ID}/render-pdf`;
    const errorCode = "TRADE.QUOTE.PDF_TEMPLATE_INCOMPATIBLE";
    tradePostMock.mockRejectedValue(new TenantApiClientError("Template unavailable", {
      status: 422, statusText: "Unprocessable Entity", headers: new Headers(),
      data: { success: false, statusCode: 422, errorCode, ...(reason ? { details: { reason } } : {}) },
    }, "http"));
    try {
      const workspace = () => <div lang={lang} dir={lang === "ar" ? "rtl" : "ltr"}><QuotationPdfWorkspace quotation={quote} headers={headers} /></div>;
      const view = render(workspace());
      const chooser = screen.getByRole("button", { name: copy.changeTemplate });
      const setupAction = () => screen.queryByRole("link", { name: t.coreOperations.templates.assignmentsTitle });
      expect(setupAction()).toBeNull();
      const open = async () => {
        chooser.focus();
        fireEvent.click(chooser, { detail: 0 });
        return screen.findByRole("dialog", { name: copy.chooseTemplate });
      };
      const close = async (dialog: HTMLElement) => {
        fireEvent.keyDown(dialog, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog", { name: copy.chooseTemplate })).toBeNull());
      };
      if (read === "denied") {
        expect(chooser).toBeDisabled();
        fireEvent.click(chooser);
        expect(fetchTemplates).not.toHaveBeenCalled();
      } else {
        const dialog = await open();
        if (read === "policy") {
          expect(await within(dialog).findByRole("alert")).toHaveTextContent(copy.libraryPolicyBlocked);
        } else {
          await waitFor(() => expect(fetchTemplates).toHaveBeenCalledWith(expect.objectContaining({
            assignmentCompanyId: COMPANY_ID, assignmentBranchId: BRANCH_ID, hasPublishedVersion: true,
            documentType: "QUOTATION", outputChannel: "PRINT", locale: copy.defaultLocale,
          }), expect.any(AbortSignal), expect.any(Function)));
          await within(dialog).findByText(copy.empty);
          expect(within(dialog).queryByRole("button", { name: copy.useTemplate })).toBeNull();
          expect(within(dialog).queryByText(draftRow.name)).toBeNull();
        }
        await close(dialog);
        if (read === "policy") {
          expect(chooser).toBeDisabled();
          await waitFor(() => expect(screen.getByRole("heading", { name: copy.title })).toHaveFocus());
        } else await waitFor(() => expect(chooser).toHaveFocus());
      }

      await act(async () => { fireEvent.click(screen.getByRole("button", { name: copy.generate })); });
      const alert = await screen.findByRole("alert");
      const definite = reason?.length === 1 && reason[0] === "no_eligible_default_assignment";
      if (definite) expect(alert).toHaveTextContent(copy.noEligibleDefaultTemplate);
      expect(tradePostMock).toHaveBeenCalledExactlyOnceWith(renderPath, expect.objectContaining({
        revisionId: REV_1_ID, locale: copy.defaultLocale,
      }), expect.objectContaining({ headers: expect.objectContaining(headers) }));
      expect(tradePostMock.mock.calls[0][1]).not.toHaveProperty("templateVersionId");
      expect(tradeGetMock).not.toHaveBeenCalled();
      if (!link) {
        expect(setupAction()).toBeNull();
        if (definite) expect(alert).toHaveTextContent(copy.defaultTemplateAdminHelp);
        return;
      }

      const setup = setupAction()!;
      const heading = screen.getByRole("heading", { name: copy.title });
      expect(setup).toHaveAttribute("href", TENANT_ROUTES.coreTemplateAssignments);
      expect(setup).toHaveAccessibleDescription(copy.businessDefaultTemplateSetup);
      const activate = (element: HTMLElement) => {
        const observation = vi.fn((event: MouseEvent) => {
          const prevented = event.defaultPrevented;
          event.preventDefault();
          return prevented;
        });
        document.addEventListener("click", observation, { once: true });
        fireEvent.click(element, { detail: 0 });
        expect(observation).toHaveBeenCalledOnce();
        return observation.mock.results[0]!.value;
      };
      setup.focus();
      expect(activate(setup)).toBe(false);
      expect(setup).toHaveFocus();
      await close(await open());
      await waitFor(() => expect(chooser).toHaveFocus());
      expect(setupAction()).toBe(setup);

      setup.focus();
      auth.readReadyProfileCommit.mockReturnValue(null);
      expect.soft(activate(setup)).toBe(true);
      expect.soft(heading).toHaveFocus();
      view.rerender(workspace());
      expect(setupAction()).toBeNull();
      expect(alert).toHaveTextContent(copy.defaultTemplateAdminHelp);

      auth.readReadyProfileCommit.mockReturnValue({ user });
      view.rerender(workspace());
      const restored = setupAction()!;
      restored.focus();
      expect(restored).toHaveFocus();
      auth.readReadyProfileCommit.mockReturnValue(null);
      view.rerender(workspace());
      expect(setupAction()).toBeNull();
      expect(heading).toHaveFocus();
    } finally {
      cleanup();
      auth.user = originalUser;
      auth.readReadyProfileCommit.mockReset();
      sessionStorage.removeItem("tenant_session_meta");
    }
  }, 15_000);

  it("renders the shared layout with frozen prices and opens saved-quotation sections without repricing", async () => {
    detailState.document = makeQuotation({ lifecycleStatus: "ACCEPTED", documentNumber: "QT-000501" });
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <QuotationDetailPage params={Promise.resolve({ id: QUOTE_ID })} searchParams={emptySearchParams} />
        </Suspense>,
      );
    });

    const t = peekLanguageSnapshot("en")!.dictionary;
    const readonly = within(screen.getByTestId("quotation-readonly-body"));
    expect(readonly.getByRole("textbox", { name: t.tradeDocuments.currency })).toHaveAttribute("readonly");
    expect(readonly.queryByRole("button", { name: t.quotationExperience.addItems })).toBeNull();
    expect(screen.queryByRole("button", { name: t.tradeDocuments.quotations.editTitle })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.audit.historyTitle }));
    expect(screen.getByTestId("record-history-stub")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: t.quotationPdf.title }).at(-1)!);
    expect(screen.getByTestId("quotation-pdf-stub")).toBeTruthy();
    expect(screen.queryByRole("button", { name: new RegExp(t.tradeDocuments.quotations.revisions) })).toBeNull();
    expect(screen.queryByRole("button", { name: t.tradeDocuments.identity })).toBeNull();
    expect(tradePostMock).not.toHaveBeenCalled();
  });

  it.each([
    { pdfJobId: PDF_JOB_ID, forwarded: PDF_JOB_ID },
    { pdfJobId: [PDF_JOB_ID, PDF_JOB_ID], forwarded: null },
    { pdfJobId: "../render-pdf", forwarded: null },
  ])("only forwards a single UUIDv7 PDF job through the issued quotation route", async ({ pdfJobId, forwarded }) => {
    detailState.document = makeQuotation({ lifecycleStatus: "SENT", documentNumber: "QT-000501" });
    const params = Promise.resolve({ id: QUOTE_ID });
    const searchParams = Promise.resolve({ pdfJobId });
    await act(async () => {
      render(<Suspense fallback={null}><QuotationDetailPage params={params} searchParams={searchParams} /></Suspense>);
    });

    if (!forwarded) {
      expect(screen.queryByTestId("quotation-pdf-stub")).toBeNull();
      const title = peekLanguageSnapshot("en")!.dictionary.quotationPdf.title;
      fireEvent.click(screen.getAllByRole("button", { name: title }).at(-1)!);
    }
    expect(screen.getByTestId("quotation-pdf-stub").getAttribute("data-reopen-job")).toBe(forwarded);
    expect(tradePostMock).not.toHaveBeenCalled();
  });

  it("saves an issued quotation's inline changes directly without a confirmation dialog", async () => {
    const snapshot = peekLanguageSnapshot("en")!;
    detailState.document = makeQuotation({ lifecycleStatus: "SENT", documentNumber: "QT-000777" });
    await act(async () => {
      render(
        <Suspense fallback={null}>
          <QuotationDetailPage params={Promise.resolve({ id: QUOTE_ID })} searchParams={emptySearchParams} />
        </Suspense>,
      );
    });

    const t = snapshot.dictionary;
    expect(screen.queryByTestId("quotation-readonly-body")).toBeNull();
    expect(screen.queryByRole("button", { name: t.tradeDocuments.quotations.newRevision })).toBeNull();
    expect(screen.getByRole("button", { name: t.quotationExperience.addItems })).toBeEnabled();
    expect(screen.queryByRole("region", { name: t.quotationFlow.draftNoteTitle })).toBeNull();
    const save = screen.getByRole("button", { name: t.common.save });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: t.quotationFlow.documentReference }), { target: { value: "INLINE-SENT" } });
    await waitFor(() => expect(save).toBeEnabled());
    fireEvent.click(save);
    await waitFor(() => expect(tradePostMock.mock.calls.filter(([path]) => String(path).endsWith("/revisions"))).toHaveLength(1));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps one unhidden primary Save on mobile while moving secondary actions into a reachable overflow menu and preserving desktop inline controls", async () => {
    const t = peekLanguageSnapshot("en")!.dictionary;
    const qCopy = t.tradeDocuments.quotations;
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    detailState.document = makeQuotation({ lifecycleStatus: "DRAFT" });

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <QuotationDetailPage params={Promise.resolve({ id: QUOTE_ID })} searchParams={emptySearchParams} />
        </Suspense>,
      );
    });
    await waitFor(() => expect(tradePostMock).toHaveBeenCalled());

    const saveButtons = screen.getAllByRole("button", { name: t.common.save });
    expect(saveButtons).toHaveLength(1);
    expect(saveButtons[0]).not.toHaveClass("hidden");

    const actionsCluster = screen.getByTestId("quotation-detail-actions");
    expect(actionsCluster).toHaveClass("shrink-0");
    expect(within(actionsCluster).queryByRole("button", { name: t.common.save })).toBeNull();

    const overflowTrigger = within(actionsCluster).getByRole("button", { name: t.common.actions });
    expect(overflowTrigger).toHaveClass("size-8", "shrink-0", "px-0");
    expect(overflowTrigger).not.toHaveClass("hidden");

    // Every other direct child of secondaryActions is hidden below md/lg so 390x844 only shows [ ⋯ ] + [ Save Changes ]
    const desktopOnlyChildren = Array.from(actionsCluster.children).filter((el) => el !== overflowTrigger);
    expect(desktopOnlyChildren.length).toBeGreaterThanOrEqual(5);
    for (const child of desktopOnlyChildren) {
      expect(child).toHaveClass("hidden");
    }
    const back = screen.getByRole("link", { name: qCopy.back });
    expect(back).toHaveAttribute("href", TENANT_ROUTES.tradeQuotations);
    expect(back).toHaveAttribute("data-page-location-override");
    expect(back).not.toHaveClass("hidden");
    expect(within(actionsCluster).getByRole("button", { name: qCopy.send })).toHaveClass("hidden", "md:inline-flex");
    expect(within(actionsCluster).getByRole("group", { name: qCopy.shareGroupLabel })).toHaveClass("hidden", "lg:inline-flex");

    // Back stays visible in the action bar when the menu is closed.
    fireEvent.pointerDown(overflowTrigger, { button: 0, ctrlKey: false });
    const menu = await screen.findByRole("menu");
    expect(within(menu).getByText(`${qCopy.unnumberedDraft} · v2`)).toBeTruthy();

    expect(within(menu).queryByRole("menuitem", { name: qCopy.back })).toBeNull();

    const sendItem = within(menu).getByRole("menuitem", { name: qCopy.send });
    expect(sendItem).toHaveClass("md:hidden");
    await waitFor(() => expect(sendItem).not.toHaveAttribute("aria-disabled"));

    const whatsappItem = within(menu).getByRole("menuitem", { name: qCopy.shareWhatsAppTooltip });
    expect(whatsappItem.closest('[role="group"]')).toHaveClass("lg:hidden");
    expect(within(menu).getByRole("menuitem", { name: qCopy.shareEmailTooltip })).toBeTruthy();
    expect(within(menu).getByRole("menuitem", { name: qCopy.shareTelegramTooltip })).toBeTruthy();

    // Desktop menu items remain unhidden across breakpoints
    expect(within(menu).queryByRole("menuitem", { name: t.quotationExperience.reviewQuotation })).toBeNull();
    expect(within(menu).getByRole("menuitem", { name: t.quotationPdf.title })).toHaveClass("md:hidden");
    expect(within(menu).getByRole("menuitem", { name: qCopy.cancel })).not.toHaveClass("md:hidden");
    expect(within(menu).getByRole("menuitem", { name: qCopy.deleteAction })).not.toHaveClass("md:hidden");

    fireEvent.click(whatsappItem);
    expect(openSpy).toHaveBeenCalledOnce();
    openSpy.mockRestore();

    // Re-open menu and trigger Send -> opens Issue Confirmation dialog
    fireEvent.pointerDown(overflowTrigger, { button: 0, ctrlKey: false });
    const sendMenu = await screen.findByRole("menu");
    fireEvent.click(within(sendMenu).getByRole("menuitem", { name: qCopy.send }));
    const issueDialog = await screen.findByRole("dialog");
    fireEvent.keyDown(issueDialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    // Make draft dirty -> primary Save enables, mobile Send disables, and mobile Cancel triggers reset confirmation
    fireEvent.change(screen.getByDisplayValue("RFQ-ROUTE-1"), { target: { value: "RFQ-ROUTE-DIRTY" } });
    await waitFor(() => expect(screen.getByRole("button", { name: t.common.save })).toBeEnabled());

    fireEvent.pointerDown(overflowTrigger, { button: 0, ctrlKey: false });
    const dirtyMenu = await screen.findByRole("menu");
    expect(within(dirtyMenu).getByRole("menuitem", { name: qCopy.send })).toHaveAttribute("aria-disabled", "true");
    const resetCancelItem = within(dirtyMenu).getByRole("menuitem", { name: t.common.cancel });
    expect(resetCancelItem).toHaveClass("md:hidden");
    fireEvent.click(resetCancelItem);
    expect(await screen.findByText(t.quotationFlow.leaveTitle)).toBeTruthy();
  });

  it("enforces Send/Cancel permissions in both desktop inline controls and RTL mobile overflow menu", async () => {
    i18nState.lang = "ar";
    const tAr = peekLanguageSnapshot("ar")!.dictionary;
    const qCopyAr = tAr.tradeDocuments.quotations;
    detailState.canWrite = (perm?: string) => perm === "trade.quotations.update" || perm === "trade.items.read";
    detailState.document = makeQuotation({ lifecycleStatus: "DRAFT" });

    await act(async () => {
      render(
        <Suspense fallback={null}>
          <QuotationDetailPage params={Promise.resolve({ id: QUOTE_ID })} searchParams={emptySearchParams} />
        </Suspense>,
      );
    });
    await waitFor(() => expect(tradePostMock).toHaveBeenCalled());

    const actionsCluster = screen.getByTestId("quotation-detail-actions");
    expect(within(actionsCluster).queryByRole("button", { name: qCopyAr.send })).toBeNull();
    expect(screen.getByRole("button", { name: tAr.common.save })).not.toHaveClass("hidden");
    expect(screen.getByRole("link", { name: qCopyAr.back })).toHaveAttribute("href", TENANT_ROUTES.tradeQuotations);

    const overflowTrigger = within(actionsCluster).getByRole("button", { name: tAr.common.actions });
    fireEvent.pointerDown(overflowTrigger, { button: 0, ctrlKey: false });
    const menu = await screen.findByRole("menu");
    expect(menu).toHaveAttribute("dir", "rtl");
    expect(within(menu).queryByRole("menuitem", { name: qCopyAr.send })).toBeNull();
    expect(within(menu).queryByRole("menuitem", { name: qCopyAr.cancel })).toBeNull();
    expect(within(menu).getByRole("menuitem", { name: qCopyAr.shareEmailTooltip })).toBeTruthy();

    fireEvent.click(within(menu).getByRole("menuitem", { name: qCopyAr.deleteAction }));
    expect(await screen.findByText(qCopyAr.deleteBlockedTitle)).toBeTruthy();
  });
});
