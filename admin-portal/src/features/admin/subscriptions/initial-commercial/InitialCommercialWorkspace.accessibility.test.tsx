// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ user: { id: "", isSuperAdmin: false, permissions: [] as string[] } }));
const locale = vi.hoisted(() => ({ lang: "en", dir: "ltr" as "ltr" | "rtl" }));
const api = vi.hoisted(() => ({ quote: vi.fn(), seed: vi.fn(), options: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => locale }));
vi.mock("./initial-commercial.api", () => ({ initialCommercialApi: api, initialSeedUrl: (id: string) => `/api/admin/core/v1/tenants/${id}/subscription` }));
import { DirectionBridge } from "@/i18n/DirectionBridge";
import { InitialCommercialWorkspace } from "./InitialCommercialWorkspace";
import { initialCommercialCopy } from "./initial-commercial-copy";
import { initialId, initialNow, initialQuoteFixture, initialTermsFixture } from "./initial-commercial.fixture";
import type { InitialQuoteView } from "../initial-commercial-readers";

const en = initialCommercialCopy("en");
const context = { purpose: "INITIAL_SEED" as const, targetTenantId: initialId(2), subscriptionId: null, subscriptionRevision: null, intentId: initialId(40) };
const scrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
// jsdom has no layout scrolling. Keep real Radix keyboard and focus handlers;
// only provide its missing layout primitive, not synthetic focus/activation.
beforeAll(() => { if (!scrollDescriptor) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: () => {} }); });
afterAll(() => { if (!scrollDescriptor) Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView"); });
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(initialNow));
  locale.lang = "en"; locale.dir = "ltr";
  auth.user = { id: initialId(30), isSuperAdmin: false, permissions: ["admin.catalog.read", "admin.subscriptions.create", "admin.subscriptions.critical"] };
  api.quote.mockResolvedValue(initialQuoteFixture());
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
async function setup() {
  render(<DirectionBridge><InitialCommercialWorkspace context={context} initialTerms={initialTermsFixture()} /></DirectionBridge>);
  await act(async () => {});
}
function deferredQuote() {
  let resolve!: (value: InitialQuoteView) => void; let reject!: (value: unknown) => void;
  const promise = new Promise<InitialQuoteView>((accept, refuse) => { resolve = accept; reject = refuse; });
  return { promise, resolve, reject };
}

describe("Initial-commercial keyboard, status and focus gaps", () => {
  it.each(["en", "ar"])("supports real Radix keyboard selection and Escape focus return in %s", async language => {
    locale.lang = language; locale.dir = language === "ar" ? "rtl" : "ltr";
    const copy = initialCommercialCopy(language);
    await setup();
    const trigger = screen.getByRole("combobox", { name: copy.cycle });
    trigger.focus(); fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await screen.findByRole("listbox");
    const monthly = screen.getByRole("option", { name: copy.monthly });
    await waitFor(() => expect(document.activeElement).toBe(monthly));
    fireEvent.keyDown(monthly, { key: "End" });
    const annual = screen.getByRole("option", { name: copy.annual });
    await waitFor(() => expect(document.activeElement).toBe(annual));
    fireEvent.keyDown(annual, { key: "Enter" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(trigger.textContent).toContain(copy.annual);
    expect(trigger.getAttribute("dir")).toBe(locale.dir);
    fireEvent.keyDown(trigger, { key: "ArrowUp" }); await screen.findByRole("listbox");
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(api.quote).not.toHaveBeenCalled(); expect(api.seed).not.toHaveBeenCalled();
  });
  it("exposes one contextual refresh status and busy controls without stealing focus", async () => {
    await setup();
    const button = screen.getByRole("button", { name: en.quote });
    fireEvent.click(button); await screen.findByRole("region", { name: en.quote });
    const deferred = deferredQuote(); api.quote.mockReturnValueOnce(deferred.promise);
    button.focus(); fireEvent.click(button);
    const status = screen.getByRole("status");
    expect(status.textContent).toBe(en.quoting);
    expect(status.closest("section")?.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button).toBeDisabled(); expect(document.activeElement).toBe(button);
    expect(screen.queryByRole("region", { name: en.quote })).toBeNull();
    const fresh = { ...initialQuoteFixture(), quoteId: initialId(55) };
    await act(async () => { deferred.resolve(fresh); });
    await screen.findByText(initialId(55));
    expect(screen.queryByRole("status")).toBeNull();
    expect(button.closest("section")?.getAttribute("aria-busy")).toBe("false");
    expect(button).not.toBeDisabled(); expect(document.activeElement).toBe(button);
  });
  it.each(["success", "failure"])("keeps current field focus when an obsolete quote resolves with %s", async outcome => {
    const deferred = deferredQuote(); api.quote.mockReturnValueOnce(deferred.promise);
    await setup(); fireEvent.click(screen.getByRole("button", { name: en.quote }));
    const signal = api.quote.mock.calls[0][1] as AbortSignal;
    const field = screen.getByRole("spinbutton", { name: en.addonSeats });
    field.focus(); fireEvent.change(field, { target: { value: "1" } }); await act(async () => {});
    await act(async () => {
      if (outcome === "success") deferred.resolve(initialQuoteFixture());
      else deferred.reject({ isNormalized: true, httpStatus: 503, errorCode: "UNAVAILABLE", message: "Unavailable", correlationId: initialId(99) });
    });
    expect(signal.aborted).toBe(true); expect(document.activeElement).toBe(field);
    expect(screen.queryByRole("region", { name: en.quote })).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(en.failure)).toBeNull();
    expect(screen.getByRole("button", { name: en.submit })).toBeDisabled();
  });
});
