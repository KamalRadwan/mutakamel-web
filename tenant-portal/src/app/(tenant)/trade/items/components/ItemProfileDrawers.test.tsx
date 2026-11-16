// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { CompanyProfileDrawer, ListingDrawer } from "./ItemProfileDrawers";

const channelId = "01900100-0000-7000-8000-000000000001";
vi.mock("../../useTradeScope", () => ({ useTradeScope: () => ({
  channels: [{ id: channelId, name: "Online store" }], isLoadingChannels: false,
}) }));
Element.prototype.scrollIntoView ??= () => {};

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: en, lang: "en", dir: "ltr" }),
}));
vi.mock("../hooks/useCatalogUoms", () => ({
  useCatalogUoms: () => ({ options: [], isLoading: false, isUnavailable: false }),
}));
vi.mock("../hooks/useItemReferenceData", () => ({
  useItemReferenceData: () => ({
    owners: [],
    taxes: [],
    companyCurrencyCode: "EGP",
    isLoading: false,
    error: null,
    search: vi.fn(),
  }),
}));

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
  });
});

afterAll(() => vi.unstubAllGlobals());

afterEach(cleanup);

describe("CompanyProfileDrawer", () => {
  it("prevents inventory settings for non-product items", () => {
    render(
      <CompanyProfileDrawer
        open
        itemKind="SERVICE"
        profile={null}
        isSubmitting={false}
        error={null}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(false)}
      />,
    );

    expect(screen.getByRole("switch", { name: en.trade.trackInventory })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /Tracking mode/ })).toBeDisabled();
    expect(screen.getByText(en.trade.itemInventoryProductOnly)).toBeInTheDocument();
  });
});

it("selects a channel by name and submits its original ID", async () => {
  const onSubmit = vi.fn().mockResolvedValue(false);
  render(<ListingDrawer open listing={null} isSubmitting={false} error={null} onClose={vi.fn()} onSubmit={onSubmit} />);
  const channel = screen.getByRole("combobox", { name: en.trade.listingChannel });
  expect(channel).toHaveClass("font-sans", "font-normal", "text-caption");
  fireEvent.keyDown(channel, { key: "ArrowDown" });
  fireEvent.click(await screen.findByRole("option", { name: "Online store" }));
  expect(channel).toHaveTextContent("Online store");
  expect(channel).not.toHaveTextContent(channelId);
  fireEvent.click(screen.getByRole("button", { name: en.trade.save }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ channelId })));
});
