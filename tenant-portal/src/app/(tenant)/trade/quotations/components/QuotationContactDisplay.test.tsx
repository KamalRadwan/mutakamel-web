// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { QuotationContactDisplay } from "./QuotationContactDisplay";
import { HEADERS, PARTY_ID } from "../hooks/quotation-composer.test-fixtures";
import type { QuotationContactOption } from "../quotation-contact-contract";

const api = vi.hoisted(() => ({ get: vi.fn(), user: { id: "contact-reader" } }));
vi.mock("../../trade-api", () => ({ tradeGet: api.get, CHANNEL_SCOPE_HEADER: "x-mutakamel-channel-id" }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: api.user, realtimeAuthGeneration: 1 }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
const CONTACT_ID = "019f0000-0000-7000-8000-000000000052";
const CONTACT: QuotationContactOption = { partyId: CONTACT_ID, displayName: "Mona Hassan", relationshipType: "CONTACT_PERSON",
  relationshipLabel: "Sales contact", isPrimary: true, email: null, mobile: null, phone: null };
const OTHER = { ...CONTACT, partyId: "019f0000-0000-7000-8000-000000000053", displayName: "Other person" };
function page(items: QuotationContactOption[], nextCursor?: string) {
  return { data: { partyType: "ORGANIZATION", items, ...(nextCursor ? { nextCursor } : {}) }, headers: new Headers(), status: 200 };
}
function display() { return render(<QuotationContactDisplay partyId={PARTY_ID} contactPartyId={CONTACT_ID} headers={HEADERS} />); }
beforeEach(() => api.get.mockReset()); afterEach(cleanup);

describe("quotation contact human identity", () => {
  it("shows the matching authorized person's name on the first page", async () => {
    api.get.mockResolvedValueOnce(page([CONTACT])); display();
    expect(await screen.findByText("Mona Hassan")).toBeTruthy(); expect(screen.queryByText(CONTACT_ID)).toBeNull();
    expect(api.get).toHaveBeenCalledOnce();
  });

  it("searches later authorized pages and stops immediately when the selected contact is found", async () => {
    api.get.mockResolvedValueOnce(page([OTHER], "opaque-page-2")).mockResolvedValueOnce(page([CONTACT], "unneeded-page-3"));
    display(); expect(await screen.findByText("Mona Hassan")).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(String(api.get.mock.calls[1][0])).toContain("cursor=opaque-page-2");
    expect(Object.fromEntries(new Headers(api.get.mock.calls[1][1].headers).entries())).toEqual(HEADERS);
    await act(async () => { await Promise.resolve(); }); expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("shows honest unavailability after the last page without rendering a raw UUID", async () => {
    api.get.mockResolvedValueOnce(page([])); display();
    expect(await screen.findByText(en.quotationExperience.contactUnavailable)).toBeTruthy();
    expect(screen.queryByText(CONTACT_ID)).toBeNull(); expect(api.get).toHaveBeenCalledOnce();
  });

  it("stops when the server repeats a cursor", async () => {
    api.get.mockResolvedValueOnce(page([OTHER], "repeat")).mockResolvedValueOnce(page([OTHER], "repeat"));
    display(); expect(await screen.findByText(en.quotationExperience.contactUnavailable)).toBeTruthy();
    await act(async () => { await Promise.resolve(); }); expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("stops on an authoritative error instead of paging or retrying", async () => {
    api.get.mockResolvedValueOnce(page([OTHER], "page-2")).mockRejectedValueOnce(new TenantApiClientError("Denied", {
      status: 403, statusText: "Forbidden", headers: new Headers(), data: { errorCode: "FORBIDDEN" },
    }));
    display(); expect(await screen.findByText(en.quotationExperience.contactUnavailable)).toBeTruthy();
    await act(async () => { await Promise.resolve(); }); expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("caps automatic resolution at20 total pages even if unique cursors never end", async () => {
    api.get.mockImplementation(async () => page([], `page-${api.get.mock.calls.length + 1}`));
    display();
    await waitFor(() => expect(screen.getByText(en.quotationExperience.contactUnavailable)).toBeTruthy());
    expect(api.get).toHaveBeenCalledTimes(20);
    expect(String(api.get.mock.calls[19][0])).toContain("cursor=page-20");
    await act(async () => { await Promise.resolve(); }); expect(api.get).toHaveBeenCalledTimes(20);
  });

  it("resets the page budget when the parent customer changes", async () => {
    api.get.mockImplementation(async () => page([], `page-${api.get.mock.calls.length + 1}`));
    const view = display();
    await screen.findByText(en.quotationExperience.contactUnavailable);
    expect(api.get).toHaveBeenCalledTimes(20);
    api.get.mockResolvedValueOnce(page([OTHER], "new-page-2")).mockResolvedValueOnce(page([CONTACT]));
    view.rerender(<QuotationContactDisplay partyId="019f0000-0000-7000-8000-000000000099" contactPartyId={CONTACT_ID} headers={HEADERS} />);
    expect(await screen.findByText("Mona Hassan")).toBeTruthy(); expect(api.get).toHaveBeenCalledTimes(22);
  });

  it("shows not recorded and avoids contact reads when no contact was selected", () => {
    render(<QuotationContactDisplay partyId={PARTY_ID} contactPartyId={null} headers={HEADERS} />);
    expect(screen.getByText(en.tradeDocuments.notRecorded)).toBeTruthy(); expect(api.get).not.toHaveBeenCalled();
  });
});
