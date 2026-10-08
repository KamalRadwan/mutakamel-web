// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { CompanyProfileDrawer } from "./ItemProfileDrawers";

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
