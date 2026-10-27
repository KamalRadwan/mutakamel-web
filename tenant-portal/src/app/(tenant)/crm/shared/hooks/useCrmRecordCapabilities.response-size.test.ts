// @vitest-environment jsdom

import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLeadCapabilities, useLeadCreateCapabilities } from "../../leads/hooks/useLeadCapabilities";
import { useLeadStagesAndCapabilities } from "../../leads/hooks/useLeadStagesAndCapabilities";
import {
  CRM_LEAD_CAPABILITIES_MAX_RESPONSE_BYTES,
  crmCapabilityAllowsOwner,
  parseCrmActionCapability,
} from "../crm-capabilities";
import { useCrmRecordCapabilities } from "./useCrmRecordCapabilities";

const BRANCH = "01900100-0000-7000-8000-000000000001";
const COMPANY = "01900100-0000-7000-8000-000000000002";
const OUTSIDE_OWNER = "01900100-0000-7000-8000-999999999999";
const BRANCHES = [BRANCH];
const SCOPE = { ready: true, headers: {
  "x-mutakamel-branch-id": BRANCH,
  "x-mutakamel-company-id": COMPANY,
}, gap: null };
const USER = {
  accessibleBranches: BRANCHES,
  accessibleCompanies: [COMPANY],
  accessibleBranchCompanies: [{ branchId: BRANCH, companyId: COMPANY }],
  teamMemberships: [],
};

vi.mock("@/context/AuthContext", () => ({ useTenantAuth: () => ({ user: USER }) }));
vi.mock("@/hooks/useOrganizationScope", () => ({
  SCOPE_UNRESOLVED_ERROR: { code: "scope-unresolved" },
  useOrganizationScopeHeaders: () => SCOPE,
}));

function payload(ownerCount: number) {
  const ownerUserIds = Array.from({ length: ownerCount }, (_, index) =>
    `01900100-0000-7000-8000-${String(index + 1).padStart(12, "0")}`);
  const team = { scope: "team", ownerUserIds };
  return {
    branchId: BRANCH,
    leads: { create: team, update: team, delete: team, convert: team },
    activities: { create: team },
    notes: { create: team, delete: team },
    attachments: { create: team, delete: team },
    opportunities: { create: team },
  };
}

function serve(body: string) {
  // Keep the real axiosClient byte enforcement and runtime parsers in the path.
  vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(
    url.includes("lead-stages") ? "[]" : body,
    { status: 200, headers: { "content-type": "application/json" } },
  )));
}

function useConsumers() {
  return {
    create: useLeadCreateCapabilities(BRANCHES, true),
    detail: useLeadCapabilities(BRANCH),
    attached: useCrmRecordCapabilities(BRANCH),
    list: useLeadStagesAndCapabilities(BRANCH),
  };
}

async function loaded(result: { current: ReturnType<typeof useConsumers> }) {
  await waitFor(() => {
    expect(result.current.create.isLoading).toBe(false);
    expect(result.current.detail.isLoading).toBe(false);
    expect(result.current.attached.isLoading).toBe(false);
    expect(result.current.list.isLoading).toBe(false);
  });
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("capability response budget", () => {
  it.each([200, 500])("loads all ten team actions with %s owners in every consumer", async (count) => {
    const response = payload(count);
    const body = JSON.stringify(response);
    expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(64 * 1024);
    expect(new TextEncoder().encode(body).byteLength).toBeLessThan(CRM_LEAD_CAPABILITIES_MAX_RESPONSE_BYTES);
    serve(body);
    const { result } = renderHook(useConsumers);
    await loaded(result);
    expect(result.current.create.degraded).toBe(false);
    expect(result.current.create.branchIds).toEqual([BRANCH]);
    expect(result.current.detail.error).toBeNull();
    expect(result.current.attached.error).toBeNull();
    expect(result.current.list.degraded.capabilities).toBe(false);
    const expected = response.leads.create;
    const capabilities = [
      result.current.create.capabilities?.get(BRANCH),
      ...Object.values(result.current.detail.capabilities),
      ...Object.values(result.current.attached.capabilities),
      ...Object.values(result.current.list.capabilities ?? {}),
    ];
    expect(capabilities.length).toBeGreaterThan(10);
    for (const capability of capabilities) {
      expect(capability).toEqual(expected);
      expect(crmCapabilityAllowsOwner(capability, expected.ownerUserIds[count - 1])).toBe(true);
      expect(crmCapabilityAllowsOwner(capability, OUTSIDE_OWNER)).toBe(false);
      expect(crmCapabilityAllowsOwner(capability, null)).toBe(false);
    }
  });

  it("preserves unavailable actions alongside a 500-owner boundary", async () => {
    const response = payload(500);
    serve(JSON.stringify({ ...response,
      leads: { ...response.leads, delete: null },
      notes: { ...response.notes, delete: null },
      attachments: { ...response.attachments, delete: null },
    }));
    const { result } = renderHook(useConsumers);
    await loaded(result);
    expect(result.current.create.branchIds).toEqual([BRANCH]);
    expect(result.current.detail.capabilities.update).toEqual(response.leads.update);
    expect(result.current.detail.capabilities.delete).toBeNull();
    expect(result.current.list.capabilities?.delete).toBeNull();
    expect(result.current.attached.capabilities.notesCreate).toEqual(response.notes.create);
    expect(result.current.attached.capabilities.notesDelete).toBeNull();
    expect(result.current.attached.capabilities.attachmentsDelete).toBeNull();
  });

  it("accepts the exact byte limit and rejects one additional byte in every consumer", async () => {
    const body = JSON.stringify(payload(500));
    serve(body.padEnd(CRM_LEAD_CAPABILITIES_MAX_RESPONSE_BYTES, " "));
    const first = renderHook(useConsumers);
    await loaded(first.result);
    expect(first.result.current.create.branchIds).toEqual([BRANCH]);
    expect(first.result.current.detail.error).toBeNull();
    expect(first.result.current.attached.error).toBeNull();
    expect(first.result.current.list.degraded.capabilities).toBe(false);
    first.unmount();

    serve(body.padEnd(CRM_LEAD_CAPABILITIES_MAX_RESPONSE_BYTES + 1, " "));
    const { result } = renderHook(useConsumers);
    await loaded(result);
    expect(result.current.create.branchIds).toEqual([]);
    expect(result.current.create.degraded).toBe(true);
    expect(result.current.detail.error?.code).toBe("API_RESPONSE_TOO_LARGE");
    expect(result.current.attached.error?.code).toBe("API_RESPONSE_TOO_LARGE");
    expect(Object.values(result.current.detail.capabilities).every((value) => value === null)).toBe(true);
    expect(Object.values(result.current.attached.capabilities).every((value) => value === null)).toBe(true);
    expect(result.current.list.capabilities).toBeNull();
    expect(result.current.list.degraded.capabilities).toBe(true);
  });

  it("rejects an owner array above the backend's 500-owner maximum", () => {
    expect(() => parseCrmActionCapability(payload(501).leads.create, "leads")).toThrow();
  });
});
