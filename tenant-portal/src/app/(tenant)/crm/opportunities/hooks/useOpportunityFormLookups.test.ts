// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient, TenantApiClientError } from "@/lib/api/axiosClient";
import { useOpportunityFormLookups } from "./useOpportunityFormLookups";

const state = vi.hoisted(() => ({ permissions: ["crm.leads.read.all"] as string[] }));
vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: state }) }));
vi.mock("@/hooks/useAuthScopeKey", () => ({ useAuthScopeKey: () => state.permissions.join(",") }));
vi.mock("@/hooks/useOrganizationScope", () => ({ useOrganizationScopeHeaders: () => ({ headers: scopeHeaders, ready: true }), SCOPE_UNRESOLVED_ERROR: { status: 0 } }));
vi.mock("@/design-system", () => ({ hasPermission: (permissions: string[], key: string) => permissions.some((value) => value === key || value.startsWith(`${key}.`)) }));
vi.mock("@/lib/api/axiosClient", async (original) => ({ ...await original<typeof import("@/lib/api/axiosClient")>(), axiosClient: { get: vi.fn() } }));

const id = (suffix: string) => `01900100-0000-7000-8000-${suffix.padStart(12, "0")}`;
const branchId = id("1");
const timestamp = "2026-11-04T09:00:00.000Z";
const contact = { partyId: id("5"), displayName: "Ahmed Tarek", isPrimary: true, phones: ["+201005428890"] };
const customer = { id: id("2"), branchId, partyId: id("3"), status: "PROSPECT", profileType: "CORPORATE", displayName: "Nile Engineering", sourceLeadId: id("4"), contacts: [contact], createdAt: timestamp, updatedAt: timestamp };
const lead = { id: id("4"), branchId, partyId: id("3"), stageId: id("10"), leadProfileType: "CORPORATE", stageFlag: "CONVERTED", status: "CONVERTED", displayName: "Nile Engineering", interestSummary: "Office expansion", createdAt: timestamp, updatedAt: timestamp };
const owner = { id: id("6"), displayName: "Kamal Radwan", avatarUrl: null };
const scopeHeaders = { "x-company-id": "company", "x-branch-id": "branch" };

beforeEach(() => {
  state.permissions = ["crm.leads.read.all"];
  vi.mocked(axiosClient.get).mockReset().mockImplementation(async (path) => {
    if (String(path).includes("assignable-owners")) return { data: { items: [owner], nextCursor: null }, status: 200, statusText: "OK", headers: new Headers() };
    return { data: String(path).includes("/leads/") ? lead : customer, status: 200, statusText: "OK", headers: new Headers() };
  });
});
afterEach(cleanup);

function setup(customerProfileId = customer.id) {
  return renderHook(() => useOpportunityFormLookups({ branchId, customerProfileId, enabled: true, action: "create" }));
}

describe("opportunity form lookups", () => {
  it("uses scoped CRM candidates and readable same-customer contact/source data", async () => {
    const { result } = setup();
    await waitFor(() => expect(result.current.customer.sourceLeads).toHaveLength(1));
    expect(result.current.customer.contacts[0]).toMatchObject({ partyId: contact.partyId, displayName: "Ahmed Tarek" });
    expect(result.current.customer.sourceLeads[0]).toMatchObject({ id: lead.id, displayName: lead.displayName, summary: "Office expansion" });
    expect(result.current.owners.items).toEqual([owner]);
    expect(axiosClient.get).toHaveBeenCalledWith(expect.stringContaining("/api/tenant/crm/v1/assignable-owners?branchId="), expect.objectContaining({ headers: scopeHeaders }));
    expect(vi.mocked(axiosClient.get).mock.calls.every(([path]) => !String(path).includes("/core/v1/users"))).toBe(true);
  });

  it("paginates owner choices and rejects mismatched source lead identity without hiding contacts", async () => {
    vi.mocked(axiosClient.get).mockImplementation(async (path) => {
      if (String(path).includes("assignable-owners")) return { data: String(path).includes("cursor=") ? { items: [{ ...owner, id: id("7") }], nextCursor: null } : { items: [owner], nextCursor: owner.id }, status: 200, statusText: "OK", headers: new Headers() };
      return { data: String(path).includes("/leads/") ? { ...lead, partyId: id("99") } : customer, status: 200, statusText: "OK", headers: new Headers() };
    });
    const { result } = setup();
    await waitFor(() => expect(result.current.customer.leadError).not.toBeNull());
    expect(result.current.customer.error).toBeNull();
    expect(result.current.customer.contacts).toHaveLength(1);
    expect(result.current.customer.sourceLeads).toEqual([]);
    expect(result.current.owners.items).toHaveLength(2);
  });

  it("exposes owner refusal separately from true empty results and can retry", async () => {
    vi.mocked(axiosClient.get).mockRejectedValueOnce(new TenantApiClientError("Denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: { code: "CRM_SCOPED_PERMISSION_DENIED" } }));
    const { result } = setup("");
    await waitFor(() => expect(result.current.owners.error?.status).toBe(403));
    expect(result.current.owners.isLoading).toBe(false);
    act(() => result.current.owners.reload());
    await waitFor(() => expect(result.current.owners.items).toEqual([owner]));
    expect(result.current.owners.error).toBeNull();
  });

  it("does not load unauthorized source leads and preserves optional lookup independence", async () => {
    state.permissions = [];
    const { result } = setup();
    await waitFor(() => expect(result.current.customer.item?.id).toBe(customer.id));
    expect(result.current.customer.leadError?.status).toBe(403);
    expect(result.current.customer.contacts).toHaveLength(1);
    expect(result.current.customer.error).toBeNull();
    expect(vi.mocked(axiosClient.get).mock.calls.some(([path]) => String(path).includes("/leads/"))).toBe(false);
  });

  it("resolves the actual saved lead independently when customer detail is forbidden", async () => {
    const savedLeadId = id("11");
    vi.mocked(axiosClient.get).mockImplementation(async (path) => {
      if (String(path).includes("assignable-owners")) return { data: { items: [owner], nextCursor: null }, status: 200, statusText: "OK", headers: new Headers() };
      if (String(path).includes("/customer-profiles/")) throw new TenantApiClientError("Denied", { status: 403, statusText: "Forbidden", headers: new Headers(), data: {} });
      return { data: { ...lead, id: savedLeadId, displayName: "Actual saved lead" }, status: 200, statusText: "OK", headers: new Headers() };
    });
    const { result } = renderHook(() => useOpportunityFormLookups({ branchId, customerProfileId: customer.id, leadId: savedLeadId, customerPartyId: customer.partyId, enabled: true, action: "update" }));
    await waitFor(() => expect(result.current.customer.sourceLeads[0]?.displayName).toBe("Actual saved lead"));
    expect(result.current.customer.error?.status).toBe(403);
    expect(result.current.customer.leadError).toBeNull();
    expect(result.current.customer.contacts).toEqual([]);
    expect(vi.mocked(axiosClient.get).mock.calls.some(([path]) => String(path).endsWith(`/leads/${savedLeadId}`))).toBe(true);
  });
});


