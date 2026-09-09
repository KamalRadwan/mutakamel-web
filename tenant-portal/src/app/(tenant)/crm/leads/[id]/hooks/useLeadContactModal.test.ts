// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { en } from "@/i18n/dictionaries/en";
import { TenantApiClientError } from "@/lib/api/axiosClient";
import { readCoreData, readCrmBody, writeCoreData } from "@/lib/api/envelope";
import { runCrmWrite } from "../../../shared/crm-write";
import type { LeadContact, LeadDetail } from "../../lead-contract";
import { CONTACT_DIRECTORY_PERMISSIONS } from "../contact-modal-contract";
import { useLeadContactModal } from "./useLeadContactModal";

const auth = vi.hoisted(() => ({ permissions: [] as string[] }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: auth }) }));
vi.mock("@/i18n/I18nContext", () => ({ useI18n: () => ({ t: en }) }));
vi.mock("@/lib/api/envelope", () => ({ readCoreData: vi.fn(), readCrmBody: vi.fn(), writeCoreData: vi.fn() }));
vi.mock("../../../shared/crm-write", async (original) => ({ ...(await original<typeof import("../../../shared/crm-write")>()), runCrmWrite: vi.fn() }));
vi.mock("../../lead-contract", async (original) => ({ ...(await original<typeof import("../../lead-contract")>()), parseLeadDetailResponse: (payload: unknown) => payload }));

const partyId = "01900100-0000-7000-8000-000000000011";
const methodId = "01900100-0000-7000-8000-000000000021";
const contact = { partyId, displayName: "Dina Ali", firstName: "Dina", lastName: "Ali", honorificTitle: "Ms", jobTitle: "Manager", isPrimary: true, email: "dina@example.test", phones: [] } as unknown as LeadContact;
const lead = { id: "01900100-0000-7000-8000-000000000001", status: "OPEN", contacts: [contact] } as LeadDetail;
const person = { id: partyId, partyType: "PERSON", displayName: "Dina Ali", firstName: "Dina", lastName: "Ali", honorificTitle: "Ms", contactMethods: [{ id: methodId, partyId, methodType: "EMAIL", value: "dina@example.test", isPrimary: true, createdAt: "2026-09-01T00:00:00Z" }] };
const rejected = () => new TenantApiClientError("Rejected", { status: 422, statusText: "Unprocessable", headers: new Headers(), data: {} });
const setup = () => {
  const onSaved = vi.fn();
  const onReconcile = vi.fn();
  return { ...renderHook(() => useLeadContactModal(lead, onSaved, onReconcile, true)), onSaved, onReconcile };
};
beforeEach(() => {
  vi.clearAllMocks();
  auth.permissions = [...CONTACT_DIRECTORY_PERMISSIONS];
  vi.mocked(readCoreData).mockResolvedValue(person);
  vi.mocked(readCrmBody).mockResolvedValue(lead);
  vi.mocked(writeCoreData).mockResolvedValue(person);
  vi.mocked(runCrmWrite).mockResolvedValue({ kind: "success", value: lead, replayed: false });
});
afterEach(cleanup);

describe("useLeadContactModal", () => {
  it("loads only when opened and cancels or skips unchanged data without writes", async () => {
    const { result } = setup();
    expect(readCoreData).not.toHaveBeenCalled();
    await act(async () => result.current.openContact(contact));
    expect(result.current.canEditIdentity).toBe(true);
    expect(result.current.form?.email).toBe("dina@example.test");
    await act(async () => result.current.save());
    expect(result.current.open).toBe(false);
    await act(async () => result.current.openContact(contact));
    act(() => result.current.setField("displayName", "Dena Ali"));
    act(() => result.current.close());
    expect(writeCoreData).not.toHaveBeenCalled();
    expect(runCrmWrite).not.toHaveBeenCalled();
  });
  it("without Directory permissions edits only job title without reading Party", async () => {
    auth.permissions = [];
    const { result } = setup();
    await act(async () => result.current.openContact(contact));
    expect(readCoreData).not.toHaveBeenCalled();
    expect(result.current.canEditIdentity).toBe(false);
    act(() => result.current.setField("displayName", "Ignored"));
    expect(result.current.form?.displayName).toBe("Dina Ali");
    act(() => result.current.setField("jobTitle", "Director"));
    await act(async () => result.current.save());
    expect(writeCoreData).not.toHaveBeenCalled();
    expect(runCrmWrite).toHaveBeenCalledWith(expect.objectContaining({ body: { contacts: [{ contactPartyId: partyId, jobTitle: "Director", isPrimary: true }] } }));
  });
  it("preserves the draft after a definite rejection before any write succeeds", async () => {
    const { result } = setup();
    await act(async () => result.current.openContact(contact));
    act(() => result.current.setField("displayName", "Dena Ali"));
    vi.mocked(writeCoreData).mockRejectedValueOnce(rejected());
    await act(async () => result.current.save());
    expect(result.current.form?.displayName).toBe("Dena Ali");
    expect(result.current.failure).toBe("failed");
    expect(result.current.mustReload).toBe(false);
  });
  it("stops after partial success and blocks another Save until explicit reload", async () => {
    const { result, onReconcile } = setup();
    await act(async () => result.current.openContact(contact));
    act(() => result.current.setField("displayName", "Dena Ali"));
    act(() => result.current.setField("email", "dena@example.test"));
    vi.mocked(writeCoreData).mockResolvedValueOnce(person).mockRejectedValueOnce(rejected());
    await act(async () => result.current.save());
    expect(result.current.failure).toBe("partial");
    expect(result.current.mustReload).toBe(true);
    expect(result.current.open).toBe(true);
    expect(onReconcile).toHaveBeenCalledOnce();
    await act(async () => result.current.save());
    expect(writeCoreData).toHaveBeenCalledTimes(2);
    vi.mocked(readCoreData).mockResolvedValueOnce({ ...person, displayName: "Dena Ali" });
    await act(async () => result.current.reload());
    expect(result.current.mustReload).toBe(false);
    expect(result.current.form?.displayName).toBe("Dena Ali");
    expect(result.current.form?.email).toBe("dina@example.test");
  });
  it("marks an uncertain first write and blocks replay rather than duplicating a phone", async () => {
    const { result } = setup();
    await act(async () => result.current.openContact(contact));
    act(() => result.current.addPhone());
    act(() => result.current.setPhone(0, "+20105551234"));
    vi.mocked(writeCoreData).mockRejectedValueOnce(new Error("Network lost"));
    await act(async () => result.current.save());
    expect(result.current.failure).toBe("uncertain");
    expect(result.current.mustReload).toBe(true);
    expect(writeCoreData).toHaveBeenCalledWith("post", expect.any(String), expect.objectContaining({ methodType: "MOBILE" }), expect.objectContaining({ nonReplayable: true }));
    await act(async () => result.current.save());
    expect(writeCoreData).toHaveBeenCalledOnce();
  });
  it("refreshes the lead after successful Core-only edits and reports final refresh failure", async () => {
    const { result, onSaved } = setup();
    await act(async () => result.current.openContact(contact));
    act(() => result.current.setField("displayName", "Dena Ali"));
    vi.mocked(readCrmBody).mockRejectedValueOnce(new Error("Read failed"));
    await act(async () => result.current.save());
    expect(result.current.failure).toBe("refresh");
    expect(result.current.mustReload).toBe(true);
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("closes after successful identity editing and shows only the fresh server lead", async () => {
    const { result, onSaved } = setup();
    await act(async () => result.current.openContact(contact));
    act(() => result.current.setField("displayName", "Dena Ali"));
    const fresh = { ...lead, contacts: [{ ...contact, displayName: "Dena Ali" }] };
    vi.mocked(readCrmBody).mockResolvedValueOnce(fresh);
    await act(async () => result.current.save());
    expect(writeCoreData).toHaveBeenCalledWith("patch", `/api/tenant/core/v1/directory/parties/${partyId}`, { displayName: "Dena Ali" }, expect.any(Object));
    expect(runCrmWrite).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith(fresh);
    expect(result.current.open).toBe(false);
  });

  it("re-reads the lead immediately before replacing relationships and preserves refreshed people", async () => {
    auth.permissions = [];
    const { result } = setup();
    await act(async () => result.current.openContact(contact));
    act(() => result.current.setField("jobTitle", "Director"));
    const other = { ...contact, partyId: "01900100-0000-7000-8000-000000000099", jobTitle: "Fresh finance title", isPrimary: false };
    vi.mocked(readCrmBody).mockResolvedValueOnce({ ...lead, contacts: [contact, other] });
    await act(async () => result.current.save());
    expect(runCrmWrite).toHaveBeenCalledWith(expect.objectContaining({ body: { contacts: [
      { contactPartyId: partyId, jobTitle: "Director", isPrimary: true },
      { contactPartyId: other.partyId, jobTitle: "Fresh finance title", isPrimary: false },
    ] } }));
  });

  it("blocks after an initial Directory read failure until an explicit reload succeeds", async () => {
    const { result } = setup();
    vi.mocked(readCoreData).mockRejectedValueOnce(new Error("Read failed"));
    await act(async () => result.current.openContact(contact));
    expect(result.current.failure).toBe("refresh");
    expect(result.current.mustReload).toBe(true);
    act(() => result.current.setField("jobTitle", "Director"));
    await act(async () => result.current.save());
    expect(writeCoreData).not.toHaveBeenCalled();
    expect(runCrmWrite).not.toHaveBeenCalled();
    await act(async () => result.current.reload());
    expect(result.current.mustReload).toBe(false);
    expect(result.current.canEditIdentity).toBe(true);
  });

  it("does not replace relationships when the selected person disappeared during editing", async () => {
    auth.permissions = [];
    const { result, onReconcile } = setup();
    await act(async () => result.current.openContact(contact));
    act(() => result.current.setField("jobTitle", "Director"));
    vi.mocked(readCrmBody).mockResolvedValueOnce({ ...lead, contacts: [] });
    await act(async () => result.current.save());
    expect(result.current.mustReload).toBe(true);
    expect(runCrmWrite).not.toHaveBeenCalled();
    expect(onReconcile).toHaveBeenCalledOnce();
  });

  it("blocks a malformed successful receipt instead of replaying an applied write", async () => {
    const { result } = setup();
    await act(async () => result.current.openContact(contact));
    act(() => result.current.setField("displayName", "Dena Ali"));
    vi.mocked(writeCoreData).mockResolvedValueOnce({});
    await act(async () => result.current.save());
    expect(result.current.failure).toBe("uncertain");
    expect(result.current.mustReload).toBe(true);
    await act(async () => result.current.save());
    expect(writeCoreData).toHaveBeenCalledOnce();
  });
});
