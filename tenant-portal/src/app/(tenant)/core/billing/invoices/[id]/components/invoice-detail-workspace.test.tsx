// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { createInvoiceReadFixture } from "../../../invoice-read.fixture";
import { parseInvoiceRead, type InvoiceRead } from "../../../invoice-read";
import type { NormalizedApiError } from "@/lib/api/errors";
const state = vi.hoisted(() => ({ view: null as InvoiceRead | null, error: null as NormalizedApiError | null,
  isLoading: false, isNotFound: false, denied: false, reload: vi.fn() }));
const paymentMount = vi.hoisted(() => vi.fn());
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: { isTenantOwner: true } }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en, lang: "en" }) }));
vi.mock("@/i18n/useLanguage", async (original) => ({ ...await original<typeof import("@/i18n/useLanguage")>(), useLanguage: () => "en", useDictionary: () => en }));
vi.mock("../hooks/useInvoiceDetail", () => ({ useInvoiceDetail: () => state }));
vi.mock("./InvoicePaymentSection", () => ({ InvoicePaymentSection: (props: unknown) => { paymentMount(props); return <div>Existing payment surface</div>; } }));
const { InvoiceDetailWorkspace } = await import("./invoice-detail-workspace");
const fixture = createInvoiceReadFixture();
const view = parseInvoiceRead(fixture, { invoiceId: fixture.data.invoice.id });
beforeEach(() => { state.view = null; state.error = null; state.isLoading = false; state.isNotFound = false; state.denied = false; paymentMount.mockClear(); });
afterEach(cleanup);

describe("invoice workspace owner/evidence boundary", () => {
  it("mounts retained App/Addon evidence and existing payment surface only after validation", () => {
    state.view = view;
    render(<InvoiceDetailWorkspace invoiceId={view.invoice.id} />);
    expect(screen.getByText(en.invoiceEvidence.title)).toBeInTheDocument();
    expect(screen.getByText("Existing payment surface")).toBeInTheDocument();
    expect(paymentMount).toHaveBeenCalledWith({ invoiceId: view.invoice.id, status: view.invoice.status, onSettled: state.reload });
  });
  it("uses actual403 to override a stale owner profile and hide any stale invoice", () => {
    state.view = view; state.denied = true; state.error = { status: 403 };
    render(<InvoiceDetailWorkspace invoiceId={view.invoice.id} />);
    expect(screen.getByText(en.coreBilling.ownerOnlyTitle)).toBeInTheDocument();
    expect(screen.queryByText(view.invoice.number)).not.toBeInTheDocument();
    expect(screen.queryByText(en.invoiceEvidence.title)).not.toBeInTheDocument();
    expect(paymentMount).not.toHaveBeenCalled();
  });
  it.each(["loading", "missing", "unavailable"])("does not start payment reads while invoice is %s", (kind) => {
    if (kind === "loading") state.isLoading = true;
    if (kind === "missing") { state.isNotFound = true; state.error = { status: 404 }; }
    if (kind === "unavailable") state.error = { status: 503 };
    render(<InvoiceDetailWorkspace invoiceId={view.invoice.id} />);
    expect(paymentMount).not.toHaveBeenCalled();
    expect(screen.queryByText(en.invoiceEvidence.title)).not.toBeInTheDocument();
  });
});
