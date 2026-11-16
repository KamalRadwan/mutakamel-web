// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { BRANCH_SCOPE_HEADER, COMPANY_SCOPE_HEADER } from "@/lib/api/organization-scope";
import type { NormalizedApiError } from "@/lib/api/errors";
import type { QuotationComposerState } from "../hooks/useQuotationComposer";
import type { TradeScopeGap } from "../../trade-scope";
import { QuotationContextFields } from "./QuotationContextFields";

const COMPANY_ID = "01890000-0000-7000-8000-000000000001";
const BRANCH_ID = "01890000-0000-7000-8000-000000000002";
const BRANCH_2_ID = "01890000-0000-7000-8000-000000000003";
const CHANNEL_ID = "01890000-0000-7000-8000-000000000090";

const DICTIONARIES = { en, ar } as const;
const DIRECTIONS = { en: "ltr", ar: "rtl" } as const;

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "ar",
  companyOptions: [] as { value: string; label: string; resolved?: boolean }[],
  branchOptions: [] as { value: string; label: string; resolved?: boolean }[],
  selectCompany: vi.fn(),
  selectBranch: vi.fn(),
  selectChannel: vi.fn(),
  refreshBranches: vi.fn(),
  refreshChannels: vi.fn(),
  scope: {
    context: {
      companyId: "01890000-0000-7000-8000-000000000001" as string | null,
      branchId: "01890000-0000-7000-8000-000000000002" as string | null,
      channelId: null as string | null | undefined,
    },
    companyIds: ["01890000-0000-7000-8000-000000000001"] as string[],
    branchIds: ["01890000-0000-7000-8000-000000000002"] as string[],
    channels: [] as { id: string; name: string }[],
    isLoadingBranches: false,
    branchesError: null as NormalizedApiError | null,
    refreshBranches: vi.fn(),
    isLoadingChannels: false,
    channelsError: null as NormalizedApiError | null,
    refreshChannels: vi.fn(),
    contextLocked: false,
    gap: null as TradeScopeGap | null,
  },
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: DICTIONARIES[state.lang],
    lang: state.lang,
    dir: DIRECTIONS[state.lang],
  }),
}));

vi.mock("@/hooks/useTenantOrganizationOptions", () => ({
  useTenantOrganizationOptions: (kind: "company" | "branch") =>
    kind === "company" ? state.companyOptions : state.branchOptions,
}));

vi.mock("../../useTradeScope", () => ({
  useTradeScope: () => ({
    ...state.scope,
    refreshBranches: state.refreshBranches,
    refreshChannels: state.refreshChannels,
    selectCompany: state.selectCompany,
    selectBranch: state.selectBranch,
    selectChannel: state.selectChannel,
    selectContext: vi.fn(),
    headersFor: () => ({}),
    gapFor: () => state.scope.gap,
    registerContextGuard: () => () => undefined,
    applyContextChange: vi.fn(),
  }),
}));

function buildComposer(overrides: Partial<QuotationComposerState> = {}): QuotationComposerState {
  return {
    lockedHeaders: null,
    savingStep: "idle",
    write: {
      isWriting: false,
      isBlocked: false,
      ambiguous: null,
      writeError: null,
      runWrite: vi.fn(),
      clearWriteError: vi.fn(),
    },
    scopeChangePending: null,
    isChangingScope: false,
    canSubmit: true,
    confirmScopeChange: vi.fn(),
    cancelScopeChange: vi.fn(),
    ...overrides,
  } as unknown as QuotationComposerState;
}

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  state.lang = "en";
  state.companyOptions = [{ value: COMPANY_ID, label: "Atlas Supply", resolved: true }];
  state.branchOptions = [{ value: BRANCH_ID, label: "Cairo HQ", resolved: true }];
  state.scope = {
    context: { companyId: COMPANY_ID, branchId: BRANCH_ID, channelId: CHANNEL_ID },
    companyIds: [COMPANY_ID],
    branchIds: [BRANCH_ID],
    channels: [{ id: CHANNEL_ID, name: "Direct sales" }],
    isLoadingBranches: false,
    branchesError: null,
    refreshBranches: state.refreshBranches,
    isLoadingChannels: false,
    channelsError: null,
    refreshChannels: state.refreshChannels,
    contextLocked: false,
    gap: null,
  };
});

describe("QuotationContextFields mobile compact summary and desktop preservation", () => {
  it("hides the scope grid for a sole resolved company and branch, then shows Branch alone when another branch is available", () => {
    const composer = buildComposer();
    const renderDetails = (channel: React.ReactNode) => <div>{channel}</div>;
    const { rerender } = render(<QuotationContextFields composer={composer} embedded renderDetails={renderDetails} />);
    expect(screen.queryByRole("region", { name: en.trade.scopeTitle })).toBeNull();
    expect(screen.getByRole("combobox", { name: /Channel/i })).toBeTruthy();

    state.scope.branchIds = [BRANCH_ID, BRANCH_2_ID];
    state.branchOptions.push({ value: BRANCH_2_ID, label: "Alexandria", resolved: true });
    rerender(<QuotationContextFields composer={composer} embedded renderDetails={renderDetails} />);
    const grid = screen.getByRole("region", { name: en.trade.scopeTitle });
    expect(within(grid).getAllByRole("combobox")).toHaveLength(1);
    expect(within(grid).getByRole("combobox", { name: /Branch/i })).toBeTruthy();
  });

  it("groups resolved Company/Branch/Channel into a compact mobile summary with accessible expand and picker while keeping desktop sm:grid-cols-3", () => {
    render(<QuotationContextFields composer={buildComposer()} embedded />);

    const summaryText = "Atlas Supply · Cairo HQ · Direct sales";
    const summaryButton = screen.getByRole("button", { name: `${en.trade.scopeTitle}: ${summaryText}` });
    expect(summaryButton).toHaveAttribute("aria-expanded", "false");
    expect(summaryButton.className).toContain("sm:hidden");
    expect(summaryButton.className).toContain("ds-hit-area");

    const bdiSegments = Array.from(summaryButton.querySelectorAll("bdi")).map((node) => node.textContent);
    expect(bdiSegments).toEqual(["Atlas Supply", "Cairo HQ", "Direct sales"]);

    const fieldsId = summaryButton.getAttribute("aria-controls");
    expect(fieldsId).toBeTruthy();
    const fieldsGrid = document.getElementById(fieldsId!);
    expect(fieldsGrid).toBeTruthy();
    expect(fieldsGrid!.className).toContain("hidden");
    expect(fieldsGrid!.className).toContain("sm:grid");
    expect(fieldsGrid!.className).toContain("sm:grid-cols-3");

    fireEvent.click(summaryButton);
    expect(summaryButton).toHaveAttribute("aria-expanded", "true");
    expect(fieldsGrid!.className).not.toContain("hidden");
    expect(fieldsGrid!.className).toContain("grid");
    expect(fieldsGrid!.className).toContain("sm:grid-cols-3");

    const branchTrigger = within(fieldsGrid!).getByRole("combobox", { name: `${en.trade.scopeBranch}: Cairo HQ` });
    expect(branchTrigger).toBeEnabled();
    expect(within(fieldsGrid!).getByRole("combobox", { name: `${en.trade.scopeCompany}: Atlas Supply` })).toBeEnabled();
    expect(within(fieldsGrid!).getByRole("combobox", { name: `${en.trade.scopeChannel}: Direct sales` })).toBeEnabled();

    fireEvent.click(summaryButton);
    expect(summaryButton).toHaveAttribute("aria-expanded", "false");
    expect(fieldsGrid!.className).toContain("hidden");
  });

  it("renders RTL Arabic compact summary matching approved reference 12-mobile-rtl-r2", () => {
    state.lang = "ar";
    state.companyOptions = [{ value: COMPANY_ID, label: "أطلس للتوريدات", resolved: true }];
    state.branchOptions = [{ value: BRANCH_ID, label: "القاهرة", resolved: true }];
    state.scope.channels = [{ id: CHANNEL_ID, name: "مبيعات مباشرة" }];

    render(<QuotationContextFields composer={buildComposer()} embedded />);

    const expectedSummary = "أطلس للتوريدات · القاهرة · مبيعات مباشرة";
    const summaryButton = screen.getByRole("button", { name: `${ar.trade.scopeTitle}: ${expectedSummary}` });
    expect(summaryButton).toHaveAttribute("aria-expanded", "false");
    expect(Array.from(summaryButton.querySelectorAll("bdi")).map((el) => el.textContent)).toEqual([
      "أطلس للتوريدات",
      "القاهرة",
      "مبيعات مباشرة",
    ]);
  });

  it("retains compact summary and expandable read-only locked cards in edit/locked/ambiguous states", () => {
    state.companyOptions = [{ value: COMPANY_ID, label: "Mersany Solutions", resolved: true }];
    state.branchOptions = [{ value: BRANCH_ID, label: "Mersany Solutions", resolved: true }];
    state.scope.context.channelId = null;

    const lockedComposer = buildComposer({
      lockedHeaders: { [COMPANY_SCOPE_HEADER]: COMPANY_ID, [BRANCH_SCOPE_HEADER]: BRANCH_ID },
    });
    const { rerender } = render(<QuotationContextFields composer={lockedComposer} contextLocked embedded />);

    const summaryText = `Mersany Solutions · Mersany Solutions · ${en.trade.scopeNoChannel}`;
    const summaryButton = screen.getByRole("button", { name: `${en.trade.scopeTitle}: ${summaryText}` });
    expect(summaryButton).toBeEnabled();
    expect(summaryButton.className).toContain("bg-muted");
    expect(summaryButton).toHaveAttribute("aria-expanded", "false");

    const fieldsGrid = document.getElementById(summaryButton.getAttribute("aria-controls")!)!;
    expect(fieldsGrid.className).toContain("hidden");

    fireEvent.click(summaryButton);
    expect(summaryButton).toHaveAttribute("aria-expanded", "true");
    expect(fieldsGrid.className).toContain("grid");
    expect(screen.getByLabelText(`${en.trade.scopeCompany}: Mersany Solutions`)).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByLabelText(`${en.trade.scopeBranch}: Mersany Solutions`)).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByLabelText(`${en.trade.scopeChannel}: ${en.trade.scopeNoChannel}`)).toHaveAttribute("aria-readonly", "true");
    expect(screen.getByRole("status")).toHaveTextContent(en.quotationFlow.contextLocked);

    const ambiguousComposer = buildComposer({
      lockedHeaders: { [COMPANY_SCOPE_HEADER]: COMPANY_ID, [BRANCH_SCOPE_HEADER]: BRANCH_ID },
      write: {
        isWriting: false,
        isBlocked: true,
        ambiguous: { idempotencyKey: "01890000-0000-7000-8000-000000000099" } as unknown as QuotationComposerState["write"]["ambiguous"],
        writeError: null,
        runWrite: vi.fn(),
        clearWriteError: vi.fn(),
      },
    });
    rerender(<QuotationContextFields composer={ambiguousComposer} contextLocked embedded />);
    expect(screen.getByRole("status")).toHaveTextContent(en.quotationFlow.unknownMustRecover);
  });

  it("does not hide required selectors when company or branch has no value or context is unresolved", () => {
    state.scope.context = { companyId: COMPANY_ID, branchId: null, channelId: null };
    state.scope.branchIds = [BRANCH_ID, BRANCH_2_ID];
    state.branchOptions = [
      { value: BRANCH_ID, label: "Cairo HQ", resolved: true },
      { value: BRANCH_2_ID, label: "Alexandria", resolved: true },
    ];
    state.scope.gap = { kind: "BRANCH_REQUIRED" } as unknown as TradeScopeGap;

    const { rerender } = render(<QuotationContextFields composer={buildComposer()} />);

    expect(screen.queryByRole("button", { name: new RegExp(`^${en.trade.scopeTitle}:`) })).toBeNull();
    const companyBtn = screen.getByRole("combobox", { name: `${en.trade.scopeCompany}: Atlas Supply` });
    const branchBtn = screen.getByRole("combobox", { name: `${en.trade.scopeBranch}: ${en.quotationFlow.chooseBranch}` });
    const grid = companyBtn.closest("div[id]")!;
    expect(grid.className).toContain("grid");
    expect(grid.className).not.toContain("hidden");

    expect(branchBtn).toBeEnabled();
    // Channel stays unavailable until the scope has a complete company and branch.
    expect(screen.getByRole("combobox", { name: `${en.trade.scopeChannel}: ${en.trade.scopeNoChannel}` })).toBeDisabled();

    // Unresolved organization label (ordinal fallback suppressed -> nameUnavailable) stays actionable on mobile
    state.scope.context = { companyId: COMPANY_ID, branchId: BRANCH_ID, channelId: null };
    state.scope.branchIds = [BRANCH_ID];
    state.scope.gap = null;
    state.branchOptions = [{ value: BRANCH_ID, label: "Branch 1", resolved: false }];
    rerender(<QuotationContextFields composer={buildComposer()} />);

    expect(screen.queryByRole("button", { name: new RegExp(`^${en.trade.scopeTitle}:`) })).toBeNull();
    expect(screen.getByRole("combobox", { name: `${en.trade.scopeBranch}: ${en.common.nameUnavailable}` })).toBeTruthy();

    // Branch lookup error stays visible and retryable without hiding fields
    state.branchOptions = [{ value: BRANCH_ID, label: "Cairo HQ", resolved: true }];
    state.scope.branchesError = { message: "unavailable" } as NormalizedApiError;
    rerender(<QuotationContextFields composer={buildComposer()} />);

    expect(screen.queryByRole("button", { name: new RegExp(`^${en.trade.scopeTitle}:`) })).toBeNull();
    expect(screen.getByRole("alert")).toHaveTextContent(en.quotationFlow.branchesUnavailable);
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    expect(state.refreshBranches).toHaveBeenCalledTimes(1);
  });

  it("shows scope change protection inline with Stay / Discard and change / Save and change", () => {
    const confirmScopeChange = vi.fn();
    const cancelScopeChange = vi.fn();
    const composer = buildComposer({
      scopeChangePending: {
        kind: "context",
        value: { companyId: COMPANY_ID, branchId: BRANCH_2_ID, channelId: null },
        label: "Atlas Supply · Alexandria · No channel",
      },
      confirmScopeChange,
      cancelScopeChange,
    });

    render(<QuotationContextFields composer={composer} embedded />);

    expect(screen.queryByRole("dialog")).toBeNull();
    const notice = screen.getByRole("alert");
    expect(within(notice).getByText(en.quotationFlow.contextChangeTitle)).toBeTruthy();
    expect(within(notice).getByText("Atlas Supply · Alexandria · No channel")).toBeTruthy();

    fireEvent.click(within(notice).getByRole("button", { name: en.quotationFlow.stay }));
    expect(cancelScopeChange).toHaveBeenCalledTimes(1);

    fireEvent.click(within(notice).getByRole("button", { name: en.quotationFlow.discardAndChange }));
    expect(confirmScopeChange).toHaveBeenCalledWith(false);

    fireEvent.click(within(notice).getByRole("button", { name: en.quotationFlow.saveAndChange }));
    expect(confirmScopeChange).toHaveBeenCalledWith(true);
  });

  it("keeps the original leave dialog for navigation", () => {
    const confirmScopeChange = vi.fn();
    const composer = buildComposer({ scopeChangePending: { kind: "navigate" } as never, confirmScopeChange });

    render(<QuotationContextFields composer={composer} embedded />);

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(en.quotationFlow.leaveTitle)).toBeTruthy();
    expect(screen.queryByText(en.quotationFlow.contextChangeTitle)).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: en.quotationFlow.discardAndLeave }));
    expect(confirmScopeChange).toHaveBeenCalledWith(false);
  });
});
