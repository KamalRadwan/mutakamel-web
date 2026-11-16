// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/design-system";
import { readCorePage } from "@/lib/api/envelope";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";
import { CreatePriceBookModal } from "./CreatePriceBookModal";

const fixture = vi.hoisted(() => ({ t: null as unknown, lang: "en", owner: true }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: fixture.t, lang: fixture.lang, dir: fixture.lang === "ar" ? "rtl" : "ltr" }) }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ realtimeAuthGeneration: "session", user: { id: "actor", isTenantOwner: fixture.owner, permissions: [], permissionScopes: {} } }) }));
vi.mock("@/lib/api/envelope", () => ({ readCorePage: vi.fn() }));
const read = vi.mocked(readCorePage);
const CHF = "0192f3a0-0000-7000-8000-000000000001";
const JPY = "0192f3a0-0000-7000-8000-000000000002";
const rows = [
  { id: CHF, code: "CHF", name: "Swiss franc", isDefault: true, status: "ACTIVE" },
  { id: JPY, code: "JPY", name: "Japanese yen", isDefault: false, status: "ACTIVE" },
  { id: "0192f3a0-0000-7000-8000-000000000003", code: "USD", name: "US dollar", isDefault: false, status: "INACTIVE" },
];
function page(data: unknown[], total = data.length, current = 1) {
  return { data, meta: { page: current, limit: 100, total, totalPages: Math.ceil(total / 100), hasNext: current < Math.ceil(total / 100), hasPrev: current > 1 } };
}
function currencyTrigger() { return screen.getByLabelText(new RegExp((fixture.t as typeof en).tradePricing.currencyCode), { selector: "button" }); }
function submitButton() { return document.querySelector<HTMLButtonElement>('button[type="submit"]')!; }
function mount(initialCurrencyCode?: string) {
  const onSubmit = vi.fn().mockResolvedValue(true);
  render(<TooltipProvider><CreatePriceBookModal isOpen onClose={vi.fn()} onSubmit={onSubmit} isSubmitting={false} error={null} initialCurrencyCode={initialCurrencyCode} /></TooltipProvider>);
  return onSubmit;
}
beforeEach(() => {
  vi.clearAllMocks(); fixture.t = en; fixture.lang = "en"; fixture.owner = true;
  read.mockResolvedValue(page(rows));
  Element.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("Configured price-book currencies", () => {
  it.each([["en", en], ["ar", ar]] as const)("uses names and configured default in %s, without invented currencies", async (lang, t) => {
    fixture.t = t; fixture.lang = lang;
    mount();
    await waitFor(() => expect(currencyTrigger()).toHaveTextContent("Swiss franc (CHF)"));
    fireEvent.click(currencyTrigger());
    expect(await screen.findByRole("option", { name: "Swiss franc (CHF)" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "Japanese yen (JPY)" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /US dollar|SAR|AED|EGP|EUR|KWD|GBP/ })).not.toBeInTheDocument();
    expect(read).toHaveBeenCalledWith("/api/tenant/core/v1/currencies", expect.stringContaining("status=ACTIVE"), expect.any(Object));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "yen" } });
    await waitFor(() => expect(screen.queryByRole("option", { name: "Swiss franc (CHF)" })).not.toBeInTheDocument());
    expect(read).toHaveBeenCalledTimes(1);
  });

  it("selects a record by ID and sends its configured code through the existing Trade DTO", async () => {
    const onSubmit = mount();
    await waitFor(() => expect(currencyTrigger()).toHaveTextContent("Swiss franc (CHF)"));
    fireEvent.click(currencyTrigger());
    fireEvent.click(await screen.findByRole("option", { name: "Japanese yen (JPY)" }));
    fireEvent.change(screen.getByRole("textbox", { name: /Book code/ }), { target: { value: "PB-NEW" } });
    fireEvent.change(screen.getByRole("textbox", { name: /Arabic name/ }), { target: { value: "قائمة أسعار" } });
    fireEvent.click(screen.getByRole("button", { name: /Metadata only/ }));
    fireEvent.click(submitButton());
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ currencyCode: "JPY", seedMode: "EMPTY" })));
  });

  it("does not silently replace an unavailable preset currency", async () => {
    mount("EGP");
    await waitFor(() => expect(read).toHaveBeenCalledTimes(1));
    expect(submitButton()).toBeDisabled();
    expect(currencyTrigger()).toBeInTheDocument();
  });

  it("blocks creation while loading or when no active currencies exist", async () => {
    read.mockResolvedValue(page([]));
    mount();
    expect(submitButton()).toBeDisabled();
    fireEvent.click(currencyTrigger());
    expect(await screen.findByText(en.coreSettings.currencyEmpty)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
  });

  it("keeps failed loads blocked and offers retry instead of a free-text currency", async () => {
    read.mockRejectedValueOnce(new Error("offline"));
    mount();
    fireEvent.click(currencyTrigger());
    expect(await screen.findByText(en.coreSettings.currencyLoadFailed)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: en.common.retry }));
    await waitFor(() => expect(currencyTrigger()).toHaveTextContent("Swiss franc (CHF)"));
    fireEvent.click(currencyTrigger());
    await waitFor(() => expect(screen.getByRole("option", { name: "Swiss franc (CHF)" })).toBeInTheDocument());
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("reads every page so a currency beyond the first 100 is selectable", async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({ ...rows[0], id: `0192f3a0-0000-7000-8000-${String(index + 100).padStart(12, "0")}`, name: `Currency ${index}` }));
    read.mockResolvedValueOnce(page(first, 101)).mockResolvedValueOnce(page([rows[1]], 101, 2));
    mount("JPY");
    await waitFor(() => expect(currencyTrigger()).toHaveTextContent("Japanese yen (JPY)"));
    fireEvent.click(currencyTrigger());
    expect(await screen.findByRole("option", { name: "Japanese yen (JPY)" })).toBeInTheDocument();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed currency identities instead of offering an unvalidated option", async () => {
    read.mockResolvedValue(page([{ ...rows[0], id: "not-an-id" }]));
    mount();
    expect(await screen.findByText(en.coreSettings.currencyLoadFailed)).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    expect(screen.queryByText("Swiss franc (CHF)")).not.toBeInTheDocument();
  });

  it("does not fetch the directory without its read permission", () => {
    fixture.owner = false;
    mount();
    expect(read).not.toHaveBeenCalled();
    expect(submitButton()).toBeDisabled();
    expect(screen.queryByLabelText(new RegExp(en.tradePricing.currencyCode), { selector: "button" })).not.toBeInTheDocument();
  });
});
