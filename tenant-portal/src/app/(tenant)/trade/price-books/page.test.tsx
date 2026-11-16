// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import type { usePriceBooks } from "./hooks/usePriceBooks";
import PriceBooksPage from "./page";

const fixture = vi.hoisted(() => ({
  model: {} as Record<string, unknown>,
  t: null as unknown,
  lang: "en",
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("./hooks/usePriceBooks", () => ({ usePriceBooks: () => fixture.model }));
vi.mock("./components/CreatePriceBookModal", () => ({ CreatePriceBookModal: () => null }));
vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({ t: fixture.t, lang: fixture.lang, dir: fixture.lang === "ar" ? "rtl" : "ltr" }),
}));
vi.mock("@/i18n/useLanguage", () => ({
  useDictionary: () => fixture.t,
  useLanguage: () => fixture.lang,
  useDirection: () => fixture.lang === "ar" ? "rtl" : "ltr",
}));

beforeEach(() => {
  vi.clearAllMocks();
  fixture.t = en;
  fixture.lang = "en";
  fixture.model = {
    t: en, canRead: true, canManage: false, canManageDefaults: false,
    isScopeResolved: true, items: [], allItems: [],
    viewMode: "board", setViewMode: vi.fn(), search: "", setSearch: vi.fn(),
    purpose: undefined, setPurpose: vi.fn(),
    governanceFilter: undefined, setGovernanceFilter: vi.fn(),
    onlyDefaults: false, setOnlyDefaults: vi.fn(), defaultMappings: {},
    isDefaultBusy: false, isBookDefault: vi.fn(),
    setBookAsCompanyDefault: vi.fn(), removeBookCompanyDefault: vi.fn(), updateBook: vi.fn(),
    selectedIds: new Set<string>(), toggleSelectRow: vi.fn(), toggleSelectAll: vi.fn(),
    clearSelection: vi.fn(), bulkSetStatus: vi.fn(), exportSelectedCsv: vi.fn(),
    pageInfo: { page: 1, limit: 25, total: 0 }, setPage: vi.fn(),
    isLoading: false, queryError: null, createOpen: false, isSubmitting: false,
    formError: null, openCreate: vi.fn(), closeCreate: vi.fn(), create: vi.fn(), reload: vi.fn(),
  } satisfies Partial<ReturnType<typeof usePriceBooks>>;
});
afterEach(cleanup);

describe.each([{ lang: "en", t: en }, { lang: "ar", t: ar }])(
  "Price book controls in $lang",
  ({ lang, t }) => {
    it.each([
      { state: "waiting for a company", patch: { isScopeResolved: false } },
      { state: "empty results", patch: {} },
      { state: "loading", patch: { isLoading: true } },
      { state: "read failure", patch: { queryError: { status: 500, message: "Unavailable" } } },
    ])("keeps search, filters, and views usable with $state", async ({ patch }) => {
      fixture.t = t;
      fixture.lang = lang;
      fixture.model = { ...fixture.model, ...patch, t };
      render(<TooltipProvider><PriceBooksPage /></TooltipProvider>);

      const search = screen.getByPlaceholderText(t.tradePricing.searchPlaceholder);
      expect(search).toBeVisible();
      expect(search).toBeEnabled();
      const filters = screen.getByRole("button", { name: t.tradePricing.advancedFilters });
      expect(filters).toBeVisible();
      expect(filters).toBeEnabled();
      for (const name of [t.views.board, t.views.card, t.views.table]) {
        expect(screen.getByRole("radio", { name })).toBeVisible();
        expect(screen.getByRole("radio", { name })).toBeEnabled();
      }

      fireEvent.click(screen.getByRole("radio", { name: t.views.card }));
      expect(fixture.model.setViewMode).toHaveBeenCalledWith("cards");
      fireEvent.change(search, { target: { value: "USD" } });
      await waitFor(() => expect(fixture.model.setSearch).toHaveBeenCalledWith("USD"));
      fireEvent.click(filters);
      expect(await screen.findByRole("combobox", { name: t.tradePricing.bookPurpose })).toBeVisible();
      expect(screen.queryByText(/company-scoped/)).toBeNull();
    });
  },
);
