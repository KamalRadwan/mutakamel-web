import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { parseApplicationAddonAssignmentOptions, readApplicationAddonAssignmentOptions } from "./application-addon-assignment-options";
import { createAddonAssignmentOptionsFixture as fixture } from "./application-addon-assignment-options.fixture";

const id = (suffix: number) => `018ef54e-2222-7777-8888-${String(suffix).padStart(12, "0")}`;
const historical = "b4ce3816-3469-4039-9e3b-d020a24d3c9d";
const invalidUuid = "b4ce3816-3469-0039-9e3b-d020a24d3c9d";
const headers = new Headers();
const request = { userId: id(1), page: 1, limit: 20 };
afterEach(() => vi.restoreAllMocks());
const parse = (value: unknown) => parseApplicationAddonAssignmentOptions(value, request);
function change(value: unknown, path: string, replacement: unknown) {
  const keys = path.split("."); let row = value as Record<string, unknown>;
  for (const key of keys.slice(0, -1)) row = row[key] as Record<string, unknown>;
  row[keys[keys.length - 1]] = replacement;
}

describe("exact-user Addon preconditions (read only, no grant)", () => {
  it("sends only the canonical options path, pagination and version with a1MiB bound", async () => {
    const body = fixture(), signal = new AbortController().signal;
    const spy = vi.spyOn(axiosClient, "get").mockResolvedValue({ data: body, headers, status: 200, statusText: "OK" });
    await expect(readApplicationAddonAssignmentOptions(request, signal)).resolves.toEqual({ items: body.data, meta: body.meta });
    expect(spy).toHaveBeenCalledExactlyOnceWith(`/api/tenant/core/v1/users/${request.userId}/addon-assignment-options?page=1&limit=20`, {
      signal, cache: "no-store", maxResponseBytes: 1_048_576,
    });
  });
  it("refuses invalid targets and organization selectors before transport", async () => {
    const spy = vi.spyOn(axiosClient, "get");
    await expect(readApplicationAddonAssignmentOptions({ ...request, userId: "../user" })).rejects.toThrow();
    const requestWithScope = { ...request, companyId: id(8) };
    await expect(readApplicationAddonAssignmentOptions(requestWithScope)).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
  });
  it("retains stored UUIDv4 references, exact allowance/parent revisions and genuinely absent child", () => {
    const body = fixture(), row = body.data[0];
    for (const field of ["addonId", "addonSelectionId", "selectedDefinitionVersionId"] as const) row[field] = row[field].replace("-7777-", "-4777-");
    expect(parse(body)).toEqual({ items: body.data, meta: body.meta });
    expect(parse(body).items[0].assignment).toBeNull();
  });
  it("accepts both pins absent and does not manufacture a revision", () => {
    const body = fixture(); body.data[0].parentAssignment = null;
    expect(parse(body).items[0]).toMatchObject({ parentAssignment: null, assignment: null });
  });
  it("accepts an exact existing child pin only alongside its parent", () => {
    const body = fixture(); body.data[0].assignment = { id: id(6), revision: "3" };
    expect(parse(body).items[0].assignment).toEqual({ id: id(6), revision: "3" });
    body.data[0].parentAssignment = null; expect(() => parse(body)).toThrow();
  });
  it("preserves inactive, denied, blocked, adoption and capacity diagnostics without eligibility", () => {
    const body = fixture(); body.data[0].targetActive = false;
    body.data[0].localState = { parentReadiness: "BLOCKED", addonReadiness: "NOT_READY", parentDenied: true, addonDenied: true, adoptionPending: true, capacityChangePending: true };
    expect(parse(body).items[0]).toEqual(body.data[0]);
    expect(parse(body).items[0].operationalUse).toBe("NOT_EVALUATED");
  });
  it("accepts existing historical target UUIDs and empty out-of-range pages", () => {
    const body = fixture(); body.data[0].userId = historical;
    expect(parseApplicationAddonAssignmentOptions(body, { ...request, userId: historical }).items[0].userId).toBe(historical);
    body.data = []; Object.assign(body.meta, { page: 2, hasPrev: true });
    expect(parseApplicationAddonAssignmentOptions(body, { ...request, page: 2 }).items).toEqual([]);
  });
  it.each([
    ["extra", true], ["success", false], ["meta.extra", true], ["meta.page", 2], ["meta.limit", 10], ["meta.total", 2],
    ["meta.totalPages", 2], ["meta.hasNext", true], ["meta.hasPrev", true], ["timestamp", "yesterday"],
    ["data.0.contractVersion", 1], ["data.0.userId", id(99)], ["data.0.targetActive", "true"],
    ["data.0.addonKey", "trade.logistics"], ["data.0.applicationKey", "A"], ["data.0.addonId", invalidUuid],
    ["data.0.addonSelectionId", invalidUuid], ["data.0.allowanceId", historical], ["data.0.selectedDefinitionVersionId", invalidUuid],
    ["data.0.allowanceRevision", "0"], ["data.0.allowanceRevision", "01"], ["data.0.allowanceRevision", "9223372036854775808"],
    ["data.0.parentAssignment", { id: historical }], ["data.0.parentAssignment", { id: null, revision: null }],
    ["data.0.parentAssignment", { id: historical, revision: "1", extra: true }], ["data.0.parentAssignment.revision", "0"],
    ["data.0.assignment", { id: historical, revision: "1" }], ["data.0.assignment", { id: id(6), revision: "0" }],
    ["data.0.assignment", { id: id(6), revision: "1", extra: true }], ["data.0.assignment", { id: id(6) }],
    ["data.0.localState.parentReadiness", "ELIGIBLE"], ["data.0.localState.addonReadiness", "ELIGIBLE"],
    ["data.0.localState.parentDenied", "false"], ["data.0.localState.addonDenied", null],
    ["data.0.localState.adoptionPending", "false"], ["data.0.localState.capacityChangePending", null],
    ["data.0.localState.quantity", 1], ["data.0.localState.eligible", true], ["data.0.operationalUse", "GRANTED"],
    ["data.0.observation", "CURRENT"], ["data.0.email", "private@example.test"], ["data.0.unitPrice", "10.0000"], ["data.0.seats", 10],
  ])("fails closed on %s", (path, value) => {
    const body = fixture(); change(body, String(path), value); expect(() => parse(body)).toThrow("could not be verified");
  });
  it("requires one target-active observation and unique allowance IDs within a page", () => {
    const body = fixture(); body.data.push({ ...body.data[0], allowanceId: id(7), targetActive: false }); body.meta.total = 2;
    expect(() => parse(body)).toThrow(); body.data[1].targetActive = true;
    expect(parse(body).items).toHaveLength(2);
    body.data[1].allowanceId = body.data[0].allowanceId; expect(() => parse(body)).toThrow();
  });
  it("requires the canonical shape and refuses extra request fields and invalid pagination", () => {
    const body = fixture(); expect(parseApplicationAddonAssignmentOptions(body, request).items).toEqual(body.data);
    expect(() => parseApplicationAddonAssignmentOptions(body, { ...request, contractVersion: 2 } as typeof request)).toThrow();
    expect(() => parseApplicationAddonAssignmentOptions(body, { ...request, page: 0 })).toThrow();
    expect(() => parseApplicationAddonAssignmentOptions(body, { ...request, limit: 101 })).toThrow();
    expect(() => parseApplicationAddonAssignmentOptions(body, { ...request, userId: "../user" })).toThrow();
    const selector = { ...request, companyId: id(8) }; expect(() => parseApplicationAddonAssignmentOptions(body, selector)).toThrow();
  });
});
