// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { Channel } from "./channel-contract";
import { CHANNEL_UI_COPY } from "./channel-catalogue-metadata";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "ar", canManage: true, edit: vi.fn() }));
const dictionaries = { en, ar };
Element.prototype.scrollIntoView ??= () => {};
const items: Channel[] = [
  { id: "01900100-0000-7000-8000-000000000001", companyId: "01900100-0000-7000-8000-000000000003",
    code: "CAIRO-HQ", name: "Cairo branch", channelType: "INTERNAL_SALES", status: "ACTIVE",
    version: 1, configurationProfileVersionId: null, updatedAt: "2026-10-17T00:00:00.000Z" },
  { id: "01900100-0000-7000-8000-000000000002", companyId: "01900100-0000-7000-8000-000000000003",
    code: "WEB", name: "Online store", channelType: "ECOMMERCE", status: "INACTIVE",
    version: 1, configurationProfileVersionId: null, updatedAt: "2026-10-17T00:00:00.000Z" },
];
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: dictionaries[state.lang], lang: state.lang, dir: state.lang === "ar" ? "rtl" : "ltr" }) }));
vi.mock("./hooks/useChannels", () => ({ useChannels: () => ({
  items, canManage: state.canManage, scopeGap: null, isLoading: false, isRefreshing: false,
  isSubmitting: false, queryError: null, formError: null, createOpen: false, editing: null, conflict: null,
  reload: vi.fn(), openCreate: vi.fn(), openEdit: state.edit, closeCreate: vi.fn(), closeEdit: vi.fn(),
  create: vi.fn(), update: vi.fn(), dismissConflict: vi.fn(), resolveConflict: vi.fn(),
}) }));
vi.mock("../TradeScopeBar", () => ({ TradeScopeBar: () => <div data-testid="scope-controls" /> }));
vi.mock("./components/ChannelModals", () => ({
  CreateChannelModal: () => null, EditChannelModal: () => null,
  ChannelInspectModal: ({ channel }: { channel: Channel | null }) => channel ? <div role="dialog">{channel.name}</div> : null,
}));
vi.mock("@/design-system", async (original) => ({
  ...await original<typeof import("@/design-system")>(),
  PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
import TradeChannelsPage from "./page";

beforeEach(() => { state.lang = "en"; state.canManage = true; vi.clearAllMocks(); });
afterEach(cleanup);
const renderPage = () => render(<TooltipProvider><TradeChannelsPage /></TooltipProvider>);

describe("channel workspace", () => {
  it.each(["en", "ar"] as const)("keeps one scope group, four metrics and a full table without the side inspector in %s", (lang) => {
    state.lang = lang;
    const t = dictionaries[lang];
    const { container } = renderPage();
    expect(screen.getAllByTestId("scope-controls")).toHaveLength(1);
    expect(container.querySelector("dl")?.children).toHaveLength(4);
    expect(screen.getByText(CHANNEL_UI_COPY[lang].totalChannels)).toBeInTheDocument();
    expect(screen.queryByText(CHANNEL_UI_COPY[lang].inspectorTitle)).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: t.trade.channelCreate })).toHaveLength(1);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Cairo branch" })).toHaveAttribute("href", `/trade/channels/${items[0].id}`);
  });

  it("filters locally by name and switches to cards without losing the results", () => {
    renderPage();
    fireEvent.change(screen.getByRole("textbox", { name: CHANNEL_UI_COPY.en.searchPlaceholder }), { target: { value: "online" } });
    expect(screen.queryByRole("link", { name: "Cairo branch" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Online store" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: CHANNEL_UI_COPY.en.cardsView }));
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });

  it("keeps channel type and status filters working in the compact toolbar", async () => {
    renderPage();
    fireEvent.keyDown(screen.getByRole("combobox", { name: en.trade.channelType }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: en.trade.channelType_ECOMMERCE }));
    expect(screen.queryByRole("link", { name: "Cairo branch" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Online store" })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("combobox", { name: en.trade.channelType }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: CHANNEL_UI_COPY.en.allTypes }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: en.common.status }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("option", { name: en.trade.channelStatus_INACTIVE }));
    expect(screen.queryByRole("link", { name: "Cairo branch" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Online store" })).toBeInTheDocument();
  });

  it("opens quick view from a row and keeps edit clicks separate", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: `${en.trade.channelEditTitle}: Cairo branch` }));
    expect(state.edit).toHaveBeenCalledWith(items[0]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("row", { name: /Cairo branch/ }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Cairo branch");
  });

  it("keeps create and edit unavailable to a read-only actor", () => {
    state.canManage = false;
    renderPage();
    expect(screen.queryByRole("button", { name: en.trade.channelCreate })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit channel:/ })).not.toBeInTheDocument();
  });
});
