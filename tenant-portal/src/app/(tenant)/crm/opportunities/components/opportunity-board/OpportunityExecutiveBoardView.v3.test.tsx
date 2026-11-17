// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { localizedName } from "@/lib/format/localized";
import { formatNumber } from "@/lib/format/number";
import { formatTemplate } from "@/lib/format/template";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import type { OpportunityCardRecord, OpportunityStage } from "../../hooks/pipeline-types";
import { OpportunityExecutiveBoardView } from "../OpportunityExecutiveBoardView";
import type { OpportunityExecutiveBoardViewProps } from "./opportunity-board-types";
import { boardItem, boardLane, boardPipeline, boardStage } from "./opportunity-board.fixtures";

const session = vi.hoisted(() => ({ permissions: [] as string[], accessMode: "FULL" }));
const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
const directions = { en: "ltr", ar: "rtl" } as const;
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: session }) }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionaries[locale.lang], lang: locale.lang, dir: directions[locale.lang] }),
}));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(), useToast: () => ({ success: vi.fn() }),
}));
vi.mock("../../hooks/useCustomerProfileOptions", () => ({
  useCustomerProfileOptions: () => ({ items: [], isLoading: false, search: vi.fn() }),
}));
vi.mock("../../hooks/useCreateOpportunity", () => ({ useOpportunityCurrencyOptions: () => ["USD", "EGP"] }));
vi.mock("@/lib/api/axiosClient", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api/axiosClient")>(),
  axiosClient: { get: vi.fn().mockRejectedValue(new Error("unavailable")) },
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); locale.lang = "en"; session.permissions = []; session.accessMode = "FULL";
  document.documentElement.classList.remove("dark");
  localStorage.clear();
});

function renderBoard(items: OpportunityCardRecord[] = [boardItem], stages: OpportunityStage[] = [boardStage], overrides: Partial<OpportunityExecutiveBoardViewProps> = {}) {
  localStorage.setItem("tenant_lang", locale.lang);
  const pipeline = { ...boardPipeline, stages };
  const props: OpportunityExecutiveBoardViewProps = {
    pipeline, board: { pipeline, stages: stages.map((stage) => boardLane(stage, items.filter((item) => item.stageId === stage.id))) },
    branchId: boardItem.branchId, isLoading: false, isMutating: false, loadingStageId: null,
    canCreate: true, createCapability: { scope: "all", ownerUserIds: null },
    canUpdate: () => true, canDelete: () => true, onOpen: vi.fn(), onOpenQuickModal: vi.fn(),
    onOpenFullCreate: vi.fn(), onDelete: vi.fn(), onOpenActivities: vi.fn(), onCardChange: vi.fn(),
    onMoveCard: vi.fn(), onLoadMoreStage: vi.fn(), ...overrides,
  };
  return { props, ...render(<div dir={directions[locale.lang]}><OpportunityExecutiveBoardView {...props} /></div>) };
}

describe.each(["en", "ar"] as const)("OpportunityExecutiveBoardView v3 (%s)", (lang) => {
  it.each(["light", "dark"])("keeps opportunity content and v3 controls in %s", (theme) => {
    locale.lang = lang;
    document.documentElement.classList.toggle("dark", theme === "dark");
    const { container, props } = renderBoard();
    const t = dictionaries[lang];
    expect(screen.getByText(boardItem.title)).toBeInTheDocument();
    expect(screen.getByText("USD 125.00")).toBeInTheDocument();
    expect(screen.getByText(t.crmLeads.card.activityStates.NONE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: t.crmOpportunities.expandCard })).toHaveClass("size-[26px]");
    expect(screen.queryByText(boardItem.leadSourceName!)).toBeNull();
    expect(screen.queryByText(t.crmOpportunities.stageAge)).toBeNull();
    expect(container.querySelector(".border-t-swatch-purple, .border-t-swatch-indigo")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.crmOpportunities.quickInspect }));
    expect(props.onOpenQuickModal).toHaveBeenCalledWith(boardItem);
  });

  it("expands source details, keeps footer actions, and collapses again", async () => {
    locale.lang = lang; renderBoard();
    const t = dictionaries[lang];
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: t.crmOpportunities.expandCard })); });
    expect(screen.getByText(boardItem.leadSourceName!)).toBeInTheDocument();
    expect(screen.queryByText(t.crmOpportunities.stageAge)).toBeNull();
    expect(screen.getByRole("button", { name: t.crmOpportunities.quickInspect })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.crmOpportunities.collapseCard }));
    expect(screen.queryByText(boardItem.leadSourceName!)).toBeNull();
  });

  it("uses date classification and loaded-card proportions, retaining the clearable filter", () => {
    locale.lang = lang;
    const future = { ...boardItem, id: "01950000-0000-7000-8000-000000000004", title: "Future opportunity", nextOpenActivityAt: "2099-01-01T00:00:00Z", activityState: "OVERDUE" as const };
    const { container } = renderBoard([boardItem, future]);
    const segments = container.querySelectorAll("[data-activity-state]");
    expect(segments).toHaveLength(2);
    for (const segment of segments) expect(segment).toHaveStyle({ width: "50%" });
    fireEvent.click(container.querySelector('[data-activity-state="FUTURE"]')!);
    expect(screen.queryByText(boardItem.title)).toBeNull();
    expect(screen.getByText(future.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: dictionaries[lang].crmOpportunities.clearFilter }));
    expect(screen.getByText(boardItem.title)).toBeInTheDocument();
  });

  it("preserves an active zero-count segment after the board refreshes", () => {
    locale.lang = lang;
    const future = { ...boardItem, nextOpenActivityAt: "2099-01-01T00:00:00Z" };
    const { container, props, rerender } = renderBoard([future]);
    fireEvent.click(container.querySelector('[data-activity-state="FUTURE"]')!);
    const refreshed = { ...props, board: { pipeline: boardPipeline, stages: [boardLane(boardStage, [boardItem])] } };
    // Same wrapper as renderBoard, so the board updates in place instead of remounting.
    rerender(<div dir={directions[locale.lang]}><OpportunityExecutiveBoardView {...refreshed} /></div>);
    const active = container.querySelector('[data-activity-state="FUTURE"]');
    expect(active).toHaveAttribute("aria-pressed", "true");
    expect(active).toHaveStyle({ width: "0%" });
    fireEvent.click(active!);
    expect(screen.getByText(boardItem.title)).toBeInTheDocument();
  });

  it("keeps activity entry and all three compact phone channels", () => {
    locale.lang = lang; session.permissions = ["activities.create"];
    const { props } = renderBoard([{ ...boardItem, customerPhone: "+201001234567" }]);
    const t = dictionaries[lang];
    fireEvent.click(screen.getByRole("button", { name: formatTemplate(t.crmLeads.card.activityOpen, { state: t.crmLeads.card.activityStates.NONE }) }));
    expect(props.onOpenActivities).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: formatTemplate(t.crmLeadDetail.callNumber, { value: "+201001234567" }) })).toHaveAttribute("href", "tel:+201001234567");
    expect(screen.getByRole("link", { name: formatTemplate(t.crmLeadDetail.whatsappNumber, { value: "+201001234567" }) })).toHaveAttribute("href", "https://wa.me/201001234567");
    expect(screen.getByRole("link", { name: formatTemplate(t.crmLeadDetail.telegramNumber, { value: "+201001234567" }) })).toHaveAttribute("href", "https://t.me/+201001234567");
    expect(screen.queryByText(t.crmLeadDetail.callAction)).toBeNull();
  });

  it("renders the permission boundary when expanded detail is denied", async () => {
    locale.lang = lang;
    vi.mocked(axiosClient.get).mockRejectedValueOnce(new TenantApiClientError("Forbidden", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: {},
    }));
    renderBoard();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: dictionaries[lang].crmOpportunities.expandCard })); });
    expect(screen.getByText(dictionaries[lang].permissionGate.title)).toBeInTheDocument();
    expect(screen.queryByText(boardItem.leadSourceName!)).toBeNull();
  });

  it.each(["WON", "LOST"] as const)("renders neutral %s cards and the terminal empty boundary without quick add", (flag) => {
    locale.lang = lang; session.permissions = ["activities.create"];
    const stage = { ...boardStage, flag };
    const item = { ...boardItem, stageFlag: flag, status: flag, activityState: "OVERDUE" as const, cardColor: "PURPLE" as const };
    const { container, unmount, props } = renderBoard([item], [stage]);
    expect(screen.getByTestId("crm-card-activity-bar")).toHaveClass("bg-activity-none");
    expect(container.querySelector(".bg-activity-none-surface")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: formatTemplate(dictionaries[lang].crmLeads.card.activityOpen, { state: dictionaries[lang].crmLeads.card.activityStates.OVERDUE }) }));
    expect(props.onOpenActivities).toHaveBeenCalledWith(item);
    expect(screen.queryByRole("button", { name: `${dictionaries[lang].crmOpportunityDetail.createAction}: ${localizedName(stage, lang)}` })).toBeNull();
    unmount();
    const empty = renderBoard([], [stage]);
    expect(screen.getByText(dictionaries[lang].crmOpportunities.emptyStage.hint[flag])).toBeInTheDocument();
    const segments = empty.container.querySelectorAll("[data-activity-state]");
    expect(segments).toHaveLength(1); expect(segments[0]).toHaveClass("bg-activity-none");
    expect(segments[0]).toHaveStyle({ width: "100%" });
    expect(screen.queryByRole("button", { name: dictionaries[lang].crmOpportunities.emptyStage.quickAdd })).toBeNull();
  });

  it("keeps dossier access in the card menu without duplicating the expand action", () => {
    locale.lang = lang;
    const { props } = renderBoard(); const t = dictionaries[lang];
    fireEvent.keyDown(screen.getByRole("button", { name: formatTemplate(t.crmLeads.card.more, { name: boardItem.title }) }), { key: "Enter" });
    const menu = screen.getByRole("menu");
    expect(within(menu).queryByText(t.crmOpportunities.expandCard)).toBeNull();
    fireEvent.click(within(menu).getByRole("menuitem", { name: t.crmLeads.card.open }));
    expect(props.onOpen).toHaveBeenCalledWith(boardItem);
  });

  it("retains collapse, paging, importance changes, and draft transfer", () => {
    locale.lang = lang;
    const lane = boardLane(boardStage, [boardItem]); lane.pageInfo.hasMore = true;
    const { props } = renderBoard([boardItem], [boardStage], { board: { pipeline: boardPipeline, stages: [lane] } });
    const t = dictionaries[lang]; const title = localizedName(boardStage, lang);
    fireEvent.click(screen.getByRole("button", { name: t.crmOpportunities.loadMore(1, 100) }));
    expect(props.onLoadMoreStage).toHaveBeenCalledWith(boardStage.id);
    fireEvent.click(screen.getByRole("button", { name: t.crmOpportunities.clearImportance }));
    expect(props.onCardChange).toHaveBeenCalledWith(boardItem.id, { importance: 0 }, boardItem);
    fireEvent.click(screen.getByRole("button", { name: formatTemplate(t.crmOpportunities.setImportance, { level: formatNumber(3, lang) }) }));
    expect(props.onCardChange).toHaveBeenCalledWith(boardItem.id, { importance: 3 }, boardItem);
    fireEvent.click(screen.getByRole("button", { name: `${t.views.collapseColumn}: ${title}` }));
    expect(screen.queryByText(boardItem.title)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: `${t.views.expandColumn}: ${title}` }));
    fireEvent.click(screen.getByRole("button", { name: `${t.crmOpportunityDetail.createAction}: ${title}` }));
    fireEvent.change(screen.getByPlaceholderText(t.crmOpportunities.titleExample), { target: { value: "Renewal" } });
    fireEvent.change(screen.getByPlaceholderText("0.00"), { target: { value: "125.25" } });
    fireEvent.click(screen.getByRole("button", { name: t.crmOpportunities.fullForm }));
    expect(props.onOpenFullCreate).toHaveBeenCalledWith(boardStage.id, expect.objectContaining({ title: "Renewal", amount: "125.25", importance: "0", stageId: boardStage.id }));
  });

  it.each(["WON", "LOST"] as const)("routes native drops into %s through the parent's terminal move flow", (flag) => {
    locale.lang = lang;
    const target = { ...boardStage, id: "01950000-0000-7000-8000-000000000099", nameAr: "ختام", nameEn: "Terminal", flag };
    const { props } = renderBoard([boardItem], [boardStage, target]);
    const transfer = { effectAllowed: "", dropEffect: "", setData: vi.fn() };
    fireEvent.dragStart(screen.getByRole("article"), { dataTransfer: transfer });
    const column = screen.getByRole("region", { name: localizedName(target, lang) });
    fireEvent.dragOver(column, { dataTransfer: transfer });
    fireEvent.drop(column, { dataTransfer: transfer });
    expect(transfer.setData).toHaveBeenCalledWith("text/plain", boardItem.id);
    expect(props.onMoveCard).toHaveBeenCalledWith(boardItem.id, boardItem.stageId, target.id);
  });

  it("peeks at collapsed stages during native drag without changing collapse state", () => {
    vi.useFakeTimers(); locale.lang = lang;
    const target = { ...boardStage, id: "01950000-0000-7000-8000-000000000099", nameAr: "مرحلة تالية", nameEn: "Next" };
    const { props } = renderBoard([boardItem], [boardStage, target]);
    const t = dictionaries[lang]; const title = localizedName(target, lang);
    fireEvent.click(screen.getByRole("button", { name: `${t.views.collapseColumn}: ${title}` }));
    const rail = screen.getByRole("button", { name: `${t.views.expandColumn}: ${title}` }).parentElement!;
    const transfer = { effectAllowed: "", dropEffect: "", setData: vi.fn() };
    fireEvent.dragStart(screen.getByRole("article"), { dataTransfer: transfer });
    fireEvent.dragOver(rail, { dataTransfer: transfer });
    act(() => { vi.advanceTimersByTime(380); });
    const peek = screen.getByRole("region", { name: title });
    fireEvent.drop(peek, { dataTransfer: transfer });
    expect(props.onMoveCard).toHaveBeenCalledWith(boardItem.id, boardItem.stageId, target.id);
    expect(screen.getByRole("button", { name: `${t.views.expandColumn}: ${title}` })).toBeInTheDocument();
  });

  it("keeps read-only cards inspectable without quick add, drag, stars, or activity writes", () => {
    locale.lang = lang; session.accessMode = "READ_ONLY"; session.permissions = ["activities.create"];
    renderBoard(); const t = dictionaries[lang];
    expect(screen.getByRole("article")).toHaveAttribute("draggable", "false");
    expect(screen.queryByRole("button", { name: t.crmOpportunities.clearImportance })).toBeNull();
    expect(screen.queryByRole("button", { name: `${t.crmOpportunityDetail.createAction}: ${localizedName(boardStage, lang)}` })).toBeNull();
    expect(within(screen.getByText(t.crmLeads.card.activityStates.NONE).parentElement!).queryByRole("button")).toBeNull();
    expect(screen.getByRole("button", { name: t.crmOpportunities.quickInspect })).toBeInTheDocument();
  });
});
