import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { readApplicationAccess } from "./application-access-api";
import { parseApplicationAccessResponse, validateApplicationAccessRequest, type ApplicationAccessRequest } from "./application-access-contract";

const companyId = "018ef54e-2222-7777-8888-000000000001";
const branchId = "018ef54e-2222-4777-8888-000000000002";
const applicationId = "018ef54e-2222-7777-8888-000000000003";
const addonId = "018ef54e-2222-7777-8888-000000000004";
const definitionVersionId = "018ef54e-2222-7777-8888-000000000005";
const timestamp = "2026-09-07T19:00:00.000Z";
const headers = new Headers();
const requests: ApplicationAccessRequest[] = [
  { kind: "APPLICATION_ACTIVATION", companyId, applicationKey: "crm" },
  { kind: "ADDON_ACTIVATION", companyId, applicationKey: "crm", addonKey: "crm.logistics" },
  { kind: "BRANCH_OVERRIDE", branchId, applicationKey: "crm", addonKey: "crm.logistics" },
  { kind: "COMPANY_CONFIGURATION", companyId, applicationKey: "crm", addonKey: "crm.logistics" },
  { kind: "BRANCH_CONFIGURATION", branchId, applicationKey: "crm", addonKey: "crm.logistics" },
];

function fixture(request: ApplicationAccessRequest, stored = false) {
  const base = request.kind === "APPLICATION_ACTIVATION";
  const branch = "branchId" in request;
  const binding = { state: stored ? "STORED" : "NOT_CREATED", id: stored ? addonId : null, revision: stored ? "9223372036854775807" : "0" };
  const addon = { definitionVersionId: stored ? definitionVersionId : null, configVersionId: null };
  const resource: Record<string, unknown> = request.kind.endsWith("_CONFIGURATION")
    ? { kind: "CONFIGURATION", bindingState: binding.state, bindingId: binding.id, revision: binding.revision, configurationState: "NOT_CONFIGURED", currentVersion: null }
    : request.kind === "BRANCH_OVERRIDE"
      ? { kind: request.kind, ...binding, ...addon, mode: stored ? "INHERIT" : null, companyApplicationEnabled: true, companyAddonEnabled: false }
      : { kind: request.kind, ...binding, ...(base ? {} : addon), enabled: stored ? false : null };
  return {
    success: true, correlationId: "request-123", timestamp,
    data: {
      scope: { kind: branch ? "BRANCH" : "COMPANY", companyId, branchId: branch ? branchId : null },
      target: { applicationId, applicationKey: "crm", addonId: base ? null : addonId, addonKey: base ? null : "crm.logistics" },
      resource,
      source: { observedAt: timestamp, selectionState: "SELECTED", applicationLifecycleStatus: "ACTIVE",
        addonLifecycleStatus: base ? null : "ACTIVE", selectedDefinitionVersionId: base ? null : definitionVersionId,
        definitionState: base ? "NOT_APPLICABLE" : "PUBLISHED", localSourceState: "MISSING", adoptionPending: false },
      operationalUse: "NOT_EVALUATED",
    },
  };
}

afterEach(() => vi.restoreAllMocks());

describe("five closed scoped Application reads", () => {
  for (const request of requests) {
    for (const stored of [false, true]) {
      it(`${request.kind}: preserves ${stored ? "stored bigint revision" : "absence"}`, () => {
        const value = fixture(request, stored);
        expect(parseApplicationAccessResponse(value, request)).toEqual(value.data);
      });
    }
    it(`${request.kind}: calls only the exact canonical path`, async () => {
      const spy = vi.spyOn(axiosClient, "get").mockResolvedValue({ data: fixture(request), headers, status: 200, statusText: "OK" });
      const signal = new AbortController().signal;
      await readApplicationAccess(request, signal);
      const scope = "branchId" in request ? `branches/${branchId}` : `companies/${companyId}`;
      const addon = "addonKey" in request ? "/addons/crm.logistics" : "";
      const suffix = request.kind.endsWith("_CONFIGURATION") ? "/configuration" : "";
      expect(spy).toHaveBeenCalledExactlyOnceWith(`/api/tenant/core/v1/${scope}/application-activations/crm${addon}${suffix}`, {
        signal, cache: "no-store", maxResponseBytes: 1_048_576,
      });
    });
  }
  it.each([undefined, "1", "02", "2, 2"])("rejects a removed contract discriminator: %s", (version) => {
    const body = fixture(requests[0]); Object.assign(body.data, { contractVersion: version });
    expect(() => parseApplicationAccessResponse(body, requests[0])).toThrow();
  });
  it.each(["", "abc", "01", "0", "-1", "9223372036854775808", "99999999999999999999", 1])("rejects stored revision %s", (value) => {
    const body = fixture(requests[1], true);
    body.data.resource.revision = value;
    expect(() => parseApplicationAccessResponse(body, requests[1])).toThrow("could not be verified");
  });
  it.each(["envelope", "scope", "target", "resource", "source", "data"])("rejects unknown fields in %s", (level) => {
    const body = fixture(requests[1]);
    const object = level === "envelope" ? body : level === "data" ? body.data : body.data[level as "scope" | "target" | "resource" | "source"];
    Object.assign(object, { privatePayload: "must not leak" });
    expect(() => parseApplicationAccessResponse(body, requests[1])).toThrow("could not be verified");
  });
  it.each([
    { scope: { companyId: branchId } },
    { scope: { kind: "BRANCH", branchId } },
    { target: { applicationKey: "trade" } },
    { target: { addonKey: "crm.other" } },
    { target: { addonId: null } },
    { resource: { kind: "APPLICATION_ACTIVATION" } },
    { resource: { revision: "1" } },
    { resource: { enabled: false } },
    { source: { definitionState: "NOT_APPLICABLE" } },
  ])("rejects substituted or inconsistent target %j", (change) => {
    const body = fixture(requests[1]);
    for (const [key, value] of Object.entries(change)) Object.assign(body.data[key as "scope" | "target" | "resource" | "source"], value);
    expect(() => parseApplicationAccessResponse(body, requests[1])).toThrow();
  });
  it("does not accept another Branch or an operational-use grant", () => {
    const body = fixture(requests[2]);
    body.data.scope.branchId = companyId;
    expect(() => parseApplicationAccessResponse(body, requests[2])).toThrow();
    body.data.scope.branchId = branchId;
    body.data.operationalUse = "ALLOWED";
    expect(() => parseApplicationAccessResponse(body, requests[2])).toThrow();
  });
  it("rejects an unsupported configured-values projection", () => {
    const body = fixture(requests[3], true);
    body.data.resource.configurationState = "CONFIGURED";
    body.data.resource.currentVersion = { values: { secret: "never render" } };
    expect(() => parseApplicationAccessResponse(body, requests[3])).toThrow();
  });
  it("rejects base-read Addon source facts", () => {
    const body = fixture(requests[0]);
    body.data.source.addonLifecycleStatus = "ACTIVE";
    expect(() => parseApplicationAccessResponse(body, requests[0])).toThrow();
  });
  it.each([
    { kind: "APPLICATION_ACTIVATION", companyId: "../other", applicationKey: "crm" },
    { kind: "APPLICATION_ACTIVATION", companyId, applicationKey: "crm?tenant=other" },
    { kind: "ADDON_ACTIVATION", companyId, applicationKey: "crm", addonKey: "trade.inventory" },
    { kind: "BRANCH_OVERRIDE", branchId, applicationKey: "crm", addonKey: "crm.logistics", companyId },
    { kind: "BRANCH_APPLICATION", branchId, applicationKey: "crm" },
  ])("rejects invalid request before transport %j", async (request) => {
    const spy = vi.spyOn(axiosClient, "get");
    expect(() => validateApplicationAccessRequest(request)).toThrow();
    await expect(readApplicationAccess(request as ApplicationAccessRequest)).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
  it("preserves exact backend errors rather than synthesizing absence", async () => {
    const error = new Error("permission denied");
    vi.spyOn(axiosClient, "get").mockRejectedValue(error);
    await expect(readApplicationAccess(requests[0])).rejects.toBe(error);
  });
});
