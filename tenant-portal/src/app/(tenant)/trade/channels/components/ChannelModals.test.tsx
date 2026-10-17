// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { Channel } from "../channel-contract";

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mocks = vi.hoisted(() => ({ lang: "en" as "en" | "ar" }));
const dictionaries = { en, ar };
const directions = { en: "ltr", ar: "rtl" };

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: dictionaries[mocks.lang],
    lang: mocks.lang,
    dir: directions[mocks.lang],
  }),
}));

const { ChannelInspectModal, CreateChannelModal, EditChannelModal } = await import(
  "./ChannelModals"
);

const EXISTING_CHANNELS: Channel[] = [
  {
    id: "ch-1",
    companyId: "comp-1",
    code: "POS-CAIRO-MAIN",
    name: "Main Retail POS",
    channelType: "POS",
    status: "ACTIVE",
    configurationProfileVersionId: null,
    version: 3,
    updatedAt: "2026-01-02T00:00:00Z",
  },
];

beforeEach(() => {
  mocks.lang = "en";
});
afterEach(cleanup);

describe("ChannelModals UI component suite", () => {
  it.each(["en", "ar"] as const)(
    "renders CreateChannelModal with starter templates and duplicate-code suggestions in %s",
    (lang) => {
      mocks.lang = lang;
      const onSubmit = vi.fn().mockResolvedValue(true);
      render(
        <CreateChannelModal
          isOpen
          isSubmitting={false}
          error={null}
          onClose={vi.fn()}
          onSubmit={onSubmit}
          existingChannels={EXISTING_CHANNELS}
        />,
      );

      const codeInput = screen.getByPlaceholderText(dictionaries[lang].trade.channelCode);
      fireEvent.change(codeInput, { target: { value: "POS-CAIRO-MAIN" } });

      // Should surface duplicate code warning and 1-click suggestion POS-CAIRO-MAIN-02
      expect(screen.getByText(dictionaries[lang].trade.channelCodeTaken)).toBeInTheDocument();
      const suggestionBtn = screen.getByRole("button", { name: "POS-CAIRO-MAIN-02" });
      expect(suggestionBtn).toBeInTheDocument();

      fireEvent.click(suggestionBtn);
      expect(
        screen.queryByText(dictionaries[lang].trade.channelCodeTaken),
      ).not.toBeInTheDocument();
    },
  );

  it("renders EditChannelModal with locked code and channelType and version badge", () => {
    render(
      <EditChannelModal
        channel={EXISTING_CHANNELS[0]}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(true)}
        existingChannels={EXISTING_CHANNELS}
      />,
    );

    expect(screen.getByText("v3")).toBeInTheDocument();
    expect(screen.getByDisplayValue("POS-CAIRO-MAIN")).toHaveAttribute("readonly");
    expect(screen.getByDisplayValue("Main Retail POS")).not.toHaveAttribute("readonly");
  });

  it("renders ChannelInspectModal 360° quick-inspect dialog and triggers onEdit", () => {
    const onEdit = vi.fn();
    const onClose = vi.fn();
    render(
      <ChannelInspectModal
        channel={EXISTING_CHANNELS[0]}
        canManage
        onClose={onClose}
        onEdit={onEdit}
      />,
    );

    expect(screen.getAllByText("POS-CAIRO-MAIN").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Main Retail POS").length).toBeGreaterThan(0);

    const editBtn = screen.getByRole("button", {
      name: new RegExp(en.trade.channelEditTitle, "i"),
    });
    fireEvent.click(editBtn);
    expect(onEdit).toHaveBeenCalledWith(EXISTING_CHANNELS[0]);
  });
});
