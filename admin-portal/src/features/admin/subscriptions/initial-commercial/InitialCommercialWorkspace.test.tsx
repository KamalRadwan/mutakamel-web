// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ user: { id: "", isSuperAdmin: false, permissions: [] as string[] } }));
const locale = vi.hoisted(() => ({ lang: "en", dir: "ltr" }));
const api = vi.hoisted(() => ({ quote: vi.fn(), seed: vi.fn(), options: vi.fn() }));
vi.mock("@/context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => locale }));
vi.mock("./initial-commercial.api", () => ({ initialCommercialApi: api, initialSeedUrl: (id: string) => `/api/admin/core/v1/tenants/${id}/subscription` }));
import { InitialCommercialWorkspace } from "./InitialCommercialWorkspace";
import { initialCommercialCopy } from "./initial-commercial-copy";
import { initialId, initialNow, initialQuoteFixture, initialReceiptFixture, initialTermsFixture } from "./initial-commercial.fixture";
import type { InitialCommercialContext } from "./hooks/useInitialCommercial";
import { initialOptionsFixture } from "./initial-create-options.fixture";
import { ar as arabicDictionary } from "@/i18n/dictionaries/ar";
import { en as englishDictionary } from "@/i18n/dictionaries/en";

const context: InitialCommercialContext = { purpose: "INITIAL_SEED", targetTenantId: initialId(2), subscriptionId: null, subscriptionRevision: null, intentId: initialId(40) };
const en = initialCommercialCopy("en");
async function setup(scope = context) {
  const view = render(<InitialCommercialWorkspace context={scope} initialTerms={initialTermsFixture()} />);
  await act(async () => {});
  return view;
}
async function quote(copy = en) {
  fireEvent.click(screen.getByRole("button", { name: copy.quote }));
  await screen.findByRole("region", { name: copy.quote });
}
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear();
  vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(initialNow));
  auth.user = { id: initialId(30), isSuperAdmin: false, permissions: ["admin.catalog.read", "admin.subscriptions.create", "admin.subscriptions.critical"] };
  locale.lang = "en"; locale.dir = "ltr";
  api.quote.mockImplementation(async request => initialQuoteFixture(request.purpose));
  api.seed.mockResolvedValue(initialReceiptFixture());
  api.options.mockResolvedValue(initialOptionsFixture());
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Unmounted initial-commercial workspace", () => {
  it.each(["en", "ar"] as const)("localizes create-options failures and preserves evidence in %s", async (lang) => {
    locale.lang = lang; locale.dir = lang === "ar" ? "rtl" : "ltr";
    auth.user.permissions.push("admin.tenants.create");
    api.options.mockRejectedValue({ isNormalized: true, httpStatus: 409, errorCode: "HTTP_409", message: "Raw options error", correlationId: initialId(99) });
    await setup();
    fireEvent.click(screen.getByRole("button", { name: initialCommercialCopy(lang).loadOptions }));
    const copy = (lang === "ar" ? arabicDictionary : englishDictionary).apiErrorMessages;
    const alert = (await screen.findByText(copy.conflict)).closest('[role="alert"]');
    expect(alert).toHaveTextContent("HTTP_409");
    expect(alert).toHaveTextContent(initialId(99));
    expect(screen.queryByText("Raw options error")).not.toBeInTheDocument();
  });

  it("loads genuine published addon choices only on request and adds their exact definition", async () => {
    auth.user.permissions.push("admin.tenants.create");
    const terms = initialTermsFixture(); terms.applications[0].addons = [];
    render(<InitialCommercialWorkspace context={context} initialTerms={terms} />); await act(async () => {});
    expect(api.options).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.loadOptions }));
    await screen.findByRole("heading", { name: "Published Logistics" });
    fireEvent.click(screen.getByRole("button", { name: en.addAddon }));
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: en.addonSeats }).value).toBe("1");
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: en.baseSeats }).value).toBe("3");
    expect(screen.getByText(initialId(15))).toBeDefined();
    expect(api.quote).not.toHaveBeenCalled(); expect(api.seed).not.toHaveBeenCalled();
  });
  it("does not mislabel unavailable options as an empty catalogue and focuses correlated failure", async () => {
    auth.user.permissions.push("admin.tenants.create");
    api.options.mockRejectedValue({ isNormalized: true, httpStatus: 503, errorCode: "TENANT_CREATE_OPTIONS_UNAVAILABLE", message: "Unavailable", correlationId: initialId(99) });
    await setup(); fireEvent.click(screen.getByRole("button", { name: en.loadOptions }));
    const alert = (await screen.findByText(en.failure)).closest('[role="alert"]');
    expect(document.activeElement).toBe(alert); expect(alert?.textContent).toContain(initialId(99));
    expect(screen.queryByText(en.optionsEmpty)).toBeNull();
  });
  it("renders owner-supplied terms without automatic I/O or invented prices", async () => {
    await setup();
    expect(screen.getByText(initialId(11))).toBeDefined();
    expect(screen.getByText(initialId(14))).toBeDefined();
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: en.baseSeats }).value).toBe("3");
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: en.addonSeats }).value).toBe("2");
    expect(api.quote).not.toHaveBeenCalled(); expect(api.seed).not.toHaveBeenCalled();
    expect(screen.queryByText("16.8750")).toBeNull();
  });
  it("removes local parent and children explicitly, rejects empty quote, and restores original terms", async () => {
    await setup();
    fireEvent.click(screen.getByRole("button", { name: en.removeApplication }));
    await act(async () => {});
    expect(screen.queryByRole("spinbutton", { name: en.addonSeats })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en.quote }));
    const summary = (await screen.findByText(en.failure)).parentElement!;
    expect(within(summary).getByRole("link").getAttribute("href")).toBe("#initial-selected-terms");
    expect(api.quote).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: en.restore }));
    await act(async () => {});
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: en.baseSeats }).value).toBe("3");
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: en.addonSeats }).value).toBe("2");
  });
  it.each(["child", "trial"])("links and focuses the %s validation summary without a request", async field => {
    await setup();
    const input = screen.getByRole("spinbutton", { name: field === "child" ? en.addonSeats : en.trial });
    fireEvent.change(input, { target: { value: field === "child" ? "4" : "366" } });
    await act(async () => {});
    fireEvent.click(screen.getByRole("button", { name: en.quote }));
    const summary = await screen.findByText(en.failure);
    expect(document.activeElement).toBe(summary.closest('[role="alert"]'));
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const link = within(summary.parentElement!).getByRole("link");
    expect(link.getAttribute("href")).toBe(`#${input.id}`);
    expect(api.quote).not.toHaveBeenCalled();
  });
  it("shows authoritative fractional prices and separate quantities, then invalidates on edit", async () => {
    await setup(); await quote();
    const evidence = screen.getByRole("region", { name: en.quote });
    expect(within(evidence).getByText("16.8750")).toBeDefined();
    expect(within(evidence).getByText("2.1250")).toBeDefined();
    expect(within(evidence).getByText("5.2500")).toBeDefined();
    expect(evidence.querySelectorAll("details > summary")).toHaveLength(2);
    expect(within(evidence).getByText(en.allowance)).toBeDefined();
    fireEvent.change(screen.getByRole("spinbutton", { name: en.addonSeats }), { target: { value: "1" } });
    await waitFor(() => expect(screen.queryByRole("region", { name: en.quote })).toBeNull());
    expect(api.quote).toHaveBeenCalledOnce(); expect(api.seed).not.toHaveBeenCalled();
  });
  it("distinguishes in-flight from uncertain outcome and retries the exact retained intent", async () => {
    let reject!: (reason: unknown) => void;
    api.seed.mockImplementationOnce(() => new Promise((_resolve, refuse) => { reject = refuse; }));
    await setup(); await quote();
    fireEvent.click(screen.getByRole("checkbox", { name: en.review }));
    fireEvent.click(screen.getByRole("button", { name: en.submit }));
    await waitFor(() => expect(api.seed).toHaveBeenCalledOnce());
    expect(screen.getByText(en.submitting)).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe(en.submitting);
    expect(screen.getByRole("button", { name: en.submit })).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(en.pending)).toBeNull();
    expect(screen.getByRole("spinbutton", { name: en.baseSeats }).closest("fieldset")?.disabled).toBe(true);
    fireEvent.change(screen.getByRole("spinbutton", { name: en.baseSeats }), { target: { value: "9" } });
    expect(screen.getByRole<HTMLInputElement>("spinbutton", { name: en.baseSeats }).value).toBe("3");
    const originalCall = api.seed.mock.calls[0];
    await act(async () => { reject({ isNormalized: true, httpStatus: 503, errorCode: "UNAVAILABLE", message: "Unavailable", correlationId: initialId(99) }); });
    const summary = screen.getByText(en.failure).closest('[role="alert"]');
    expect(document.activeElement).toBe(summary);
    expect(summary?.textContent).toContain(initialId(99));
    expect(screen.getByText(en.pending)).toBeDefined();
    expect(screen.getByRole("status")).toContainElement(screen.getByText(en.pending));
    expect(screen.getByRole("button", { name: en.quote })).toBeDisabled();
    const retry = screen.getByRole("button", { name: en.retry });
    expect(retry).not.toBeDisabled(); expect(retry.tagName).toBe("BUTTON");
    expect(retry.getAttribute("type")).toBe("button");
    fireEvent.click(screen.getByRole("button", { name: en.retry }));
    await screen.findByRole("region", { name: en.original });
    expect(api.seed.mock.calls[1]).toEqual(originalCall);
    expect(screen.getByText(en.originalWarning)).toBeDefined();
    expect(screen.getByRole("status").textContent).toBe(en.originalWarning);
    expect(screen.getByRole("region", { name: en.original }).closest("section[aria-busy]")).toHaveAttribute("aria-busy", "false");
    expect(screen.queryByText(en.pending)).toBeNull();
  });
  it("keeps TENANT_CREATION quote-only and cannot invoke an initial seed", async () => {
    auth.user.permissions = ["admin.tenants.create"];
    await setup({ purpose: "TENANT_CREATION", intentId: initialId(40) }); await quote();
    expect(screen.getByText(en.creationReady)).toBeDefined();
    expect(screen.queryByRole("button", { name: en.submit })).toBeNull();
    expect(api.seed).not.toHaveBeenCalled();
    expect(api.quote.mock.calls[0][0]).not.toHaveProperty("targetTenantId");
  });
  it.each(["en", "ar"])("requires acknowledgement of totals, trial days and expiry before seeding in %s", async language => {
    locale.lang = language; locale.dir = language === "ar" ? "rtl" : "ltr";
    const copy = initialCommercialCopy(language);
    await setup();
    const submit = screen.getByRole("button", { name: copy.submit });
    expect(submit).toBeDisabled();
    await quote(copy);
    const review = screen.getByRole("checkbox", { name: copy.review });
    expect(review).not.toBeChecked(); expect(submit).toBeDisabled();
    fireEvent.click(submit); expect(api.seed).not.toHaveBeenCalled();
    fireEvent.click(review); expect(review).toBeChecked(); expect(submit).not.toBeDisabled();
    fireEvent.click(review); expect(submit).toBeDisabled();
    fireEvent.click(review); fireEvent.click(submit);
    await screen.findByRole("region", { name: copy.original });
    expect(api.seed).toHaveBeenCalledOnce();
  });
  it("clears acknowledgement when a replacement quote arrives", async () => {
    api.quote.mockResolvedValue(initialQuoteFixture());
    await setup(); await quote();
    fireEvent.click(screen.getByRole("checkbox", { name: en.review }));
    expect(screen.getByRole("button", { name: en.submit })).not.toBeDisabled();
    await quote();
    expect(api.quote).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("checkbox", { name: en.review })).not.toBeChecked();
    expect(screen.getByRole("button", { name: en.submit })).toBeDisabled();
    expect(api.seed).not.toHaveBeenCalled();
  });
  it.each(["base", "addon", "trial", "restore", "removeAddon", "removeApplication"] as const)("clears acknowledgement after a %s draft change", async change => {
    await setup(); await quote();
    fireEvent.click(screen.getByRole("checkbox", { name: en.review }));
    if (change === "base" || change === "addon" || change === "trial") {
      fireEvent.change(screen.getByRole("spinbutton", { name: change === "base" ? en.baseSeats : change === "addon" ? en.addonSeats : en.trial }), { target: { value: change === "base" ? "4" : "1" } });
    } else {
      fireEvent.click(screen.getByRole("button", { name: en[change] }));
    }
    expect(screen.getByRole("button", { name: en.submit })).toBeDisabled();
    // Restore can retain identical terms and the same quote object. Consent
    // must still be cleared by the draft handler itself.
    const review = screen.queryByRole("checkbox", { name: en.review });
    if (review) expect(review).not.toBeChecked();
    expect(api.seed).not.toHaveBeenCalled();
  });
  it("clears quoted evidence after actor or permission change", async () => {
    const view = await setup(); await quote();
    auth.user = { ...auth.user, id: initialId(31), permissions: [] };
    view.rerender(<InitialCommercialWorkspace context={context} initialTerms={initialTermsFixture()} />);
    await act(async () => {});
    expect(screen.queryByRole("region", { name: en.quote })).toBeNull();
    expect(screen.getByText(en.forbidden)).toBeDefined();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: en.submit }).disabled).toBe(true);
  });
  it("keeps Arabic direction, field labels and original evidence semantics", async () => {
    locale.lang = "ar"; locale.dir = "rtl";
    const ar = initialCommercialCopy("ar");
    await setup(); await quote(ar);
    expect(screen.getByRole("heading", { name: ar.seed }).closest("section")?.getAttribute("dir")).toBe("rtl");
    expect(screen.getByRole("spinbutton", { name: ar.addonSeats })).toBeDefined();
    expect(screen.getByText(ar.allowance)).toBeDefined();
    expect(screen.getAllByText(ar.brackets)).toHaveLength(2);
  });
});
