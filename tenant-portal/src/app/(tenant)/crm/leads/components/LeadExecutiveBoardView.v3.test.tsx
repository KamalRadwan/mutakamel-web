// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { localizedName } from "@/lib/format/localized";
import { formatTemplate } from "@/lib/format/template";
import type { LeadItem, LeadStage } from "../lead-list-contract";
import { LeadExecutiveBoardView } from "./LeadExecutiveBoardView";
import type { LeadExecutiveBoardViewProps } from "./lead-board/lead-board-types";

const session = vi.hoisted(() => ({ permissions: [] as string[], accessMode: "FULL" }));
const locale = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
const directions = { en: "ltr", ar: "rtl" } as const;
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: session }) }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: dictionaries[locale.lang], lang: locale.lang, dir: directions[locale.lang] }),
}));
vi.mock("../../shared/hooks/useCrmAcquisitionSources", () => ({
  useCrmAcquisitionSources: () => ({ items: [] }),
}));
vi.mock("../hooks/useLeadCompanyOptions", () => ({
  useLeadCompanyOptions: () => ({ companies: [], selectedCompany: null, searchCompanies: vi.fn(), selectCompany: vi.fn() }),
}));
vi.mock("../lead-requests", () => ({ fetchLeadDetail: vi.fn().mockRejectedValue(new Error("unavailable")) }));
vi.mock("@/design-system", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/design-system")>(),
  useCollapsedColumns: () => {
    const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
    return {
      isCollapsed: (id: string) => collapsed.has(id),
      toggle: (id: string) => setCollapsed((current) => {
        const next = new Set(current);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    };
  },
}));

beforeAll(() => {
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => { };
  Element.prototype.releasePointerCapture = () => { };
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
afterEach(() => {
  cleanup();
  locale.lang = "en";
  session.permissions = [];
  session.accessMode = "FULL";
});

const stage: LeadStage = {
  id: "01950000-0000-7000-8000-000000000010", nameAr: "جديد", nameEn: "New", flag: "NEW",
};
const lead: LeadItem = {
  id: "01950000-0000-7000-8000-000000000001",
  partyId: "01950000-0000-7000-8000-000000000002",
  leadProfileType: "INDIVIDUAL", leadName: "Dina Ali", company: "",
  email: "", phone: "", phones: [], country: "", primaryContact: null,
  sourceNameAr: "", sourceNameEn: "", sourceIconUrl: null, stageId: stage.id,
  ownerUserId: null, rating: 0, cardColor: null, owner: null, nextActivity: null, tags: [],
  stageEnteredAt: "2026-10-14T12:00:00Z",
};
function renderBoard(overrides: Partial<LeadExecutiveBoardViewProps> = {}) {
  const props: LeadExecutiveBoardViewProps = {
    items: [lead], stages: [stage], branchId: "branch", canCreate: true,
    canUpdate: () => true, canDelete: () => true, isMovePending: false,
    isLoading: false, error: null, onRetry: vi.fn(), onOpenLead: vi.fn(),
    onOpenQuickModal: vi.fn(), onOpenActivities: vi.fn(), onDeleteLead: vi.fn(),
    onMoveStage: vi.fn(), onCardChange: vi.fn(), onOpenCreateModal: vi.fn(),
    onQuickCreateLead: vi.fn().mockResolvedValue(true), hasMoreStage: () => false,
    isLoadingMoreStage: () => false, onLoadMoreStage: vi.fn(), ...overrides,
  };
  return { props, ...render(<div dir={directions[locale.lang]}><LeadExecutiveBoardView {...props} /></div>) };
}

describe.each(["en", "ar"] as const)("LeadExecutiveBoardView v3 (%s)", (lang) => {
  it("shows the no-activity pill and removes stage duration and face expansion", () => {
    locale.lang = lang;
    renderBoard();
    const t = dictionaries[lang];
    expect(screen.getByText(t.crmLeads.card.activityStates.NONE)).toBeInTheDocument();
    expect(screen.queryByText(/in stage|في المرحلة/u)).toBeNull();
    expect(screen.queryByRole("button", { name: t.crmLeads.executive.expandCard })).toBeNull();
  });

  it("expands through the card menu, keeps the v3 footer, and collapses again", () => {
    locale.lang = lang;
    const { props } = renderBoard();
    const t = dictionaries[lang];
    fireEvent.keyDown(screen.getByRole("button", { name: formatTemplate(t.crmLeads.card.more, { name: lead.leadName }) }), { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: t.crmLeads.executive.expandCard }));
    expect(screen.getByRole("button", { name: t.crmLeads.executive.collapseCard })).toBeInTheDocument();
    expect(screen.queryByText(/in stage|في المرحلة/u)).toBeNull();
    expect(screen.getByText(t.crmLeads.card.activityStates.NONE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.crmLeads.executive.quickEdit }));
    expect(props.onOpenQuickModal).toHaveBeenCalledWith(lead);
    fireEvent.click(screen.getByRole("button", { name: t.crmLeads.executive.collapseCard }));
    expect(screen.queryByRole("button", { name: t.crmLeads.executive.collapseCard })).toBeNull();
  });

  it.each(["NURTURING", "DISQUALIFIED"] as const)("renders the %s empty stage and a single grey segment", (flag) => {
    locale.lang = lang;
    const { container } = renderBoard({ items: [], stages: [{ ...stage, flag }], totals: new Map([[stage.id, 50]]) });
    const t = dictionaries[lang];
    expect(screen.getByText(t.crmLeads.emptyStage.title)).toBeInTheDocument();
    expect(screen.getByText(t.crmLeads.emptyStage.hint[flag])).toBeInTheDocument();
    const segments = container.querySelectorAll("[data-activity-state]");
    expect(segments).toHaveLength(1);
    expect(segments[0]).toHaveAttribute("data-activity-state", "NONE");
    expect(segments[0]).toHaveClass("bg-activity-none");
    expect(segments[0]).toHaveStyle({ width: "100%" });
    fireEvent.click(screen.getByRole("button", { name: t.crmLeads.emptyStage.quickAdd }));
    expect(screen.getByPlaceholderText(t.crmLeads.executive.firstName)).toBeInTheDocument();
  });

  it("uses loaded leads for proportional segments and preserves filter toggling", () => {
    locale.lang = lang;
    const future: LeadItem = { ...lead, id: "01950000-0000-7000-8000-000000000003", leadName: "Future lead", nextActivity: { activityAt: "2099-01-01T00:00:00Z", bucket: "OVERDUE" } };
    const { container } = renderBoard({ items: [lead, future], totals: new Map([[stage.id, 100]]) });
    const segments = container.querySelectorAll("[data-activity-state]");
    expect(segments).toHaveLength(2);
    for (const segment of segments) expect(segment).toHaveStyle({ width: "50%" });
    const futureSegment = container.querySelector<HTMLButtonElement>('[data-activity-state="FUTURE"]')!;
    fireEvent.click(futureSegment);
    expect(screen.queryByText(lead.leadName)).toBeNull();
    expect(screen.getByText(future.leadName)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: dictionaries[lang].crmLeads.executive.clearFilter }));
    expect(screen.getByText(lead.leadName)).toBeInTheDocument();
  });

  it("preserves collapse, expand, and stage paging", () => {
    locale.lang = lang;
    const { props } = renderBoard({ hasMoreStage: () => true });
    const t = dictionaries[lang];
    const stageLabel = localizedName(stage, lang);
    fireEvent.click(screen.getByRole("button", { name: t.crmLeads.loadMore(1, 1) }));
    expect(props.onLoadMoreStage).toHaveBeenCalledWith(stage.id);
    fireEvent.click(screen.getByRole("button", { name: t.views.collapseColumn + ": " + stageLabel }));
    expect(screen.queryByText(lead.leadName)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.views.expandColumn + ": " + stageLabel }));
    expect(screen.getByText(lead.leadName)).toBeInTheDocument();
  });

  it("transfers the quick-add draft to the full create modal", () => {
    locale.lang = lang;
    const { props } = renderBoard();
    const t = dictionaries[lang];
    const stageLabel = localizedName(stage, lang);
    fireEvent.click(screen.getByRole("button", { name: t.crmLeads.addLead + ": " + stageLabel }));
    fireEvent.change(screen.getByPlaceholderText(t.crmLeads.executive.firstName), { target: { value: "Dina" } });
    fireEvent.click(screen.getByRole("button", { name: t.crmLeads.executive.fullModal }));
    expect(props.onOpenCreateModal).toHaveBeenCalledWith(stage.id, expect.objectContaining({ firstName: "Dina", stageId: stage.id }));
  });

  it("retains read-only admission for quick add, dragging, and activity writes", () => {
    locale.lang = lang;
    session.accessMode = "READ_ONLY";
    session.permissions = ["activities.create"];
    const { container } = renderBoard();
    const t = dictionaries[lang];
    expect(screen.getByText(lead.leadName)).toBeInTheDocument();
    expect(container.querySelector("[data-rfd-drag-handle-draggable-id]")).toBeNull();
    expect(screen.queryByRole("button", { name: new RegExp(t.crmLeads.addLead) })).toBeNull();
    expect(screen.queryByRole("button", { name: formatTemplate(t.crmLeads.card.activityOpen, { state: t.crmLeads.card.activityStates.NONE }) })).toBeNull();
    expect(within(screen.getByText(t.crmLeads.card.activityStates.NONE).parentElement!).queryByRole("button")).toBeNull();
  });
});
