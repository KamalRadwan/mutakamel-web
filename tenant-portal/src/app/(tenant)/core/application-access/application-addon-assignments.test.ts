import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { parseApplicationAddonAssignments, readApplicationAddonAssignments } from "./application-addon-assignments";
import { createAddonAssignmentsFixture } from "./application-addon-assignments.fixture";
const headers = new Headers();
const request = { userId: "018ef54e-2222-7777-8888-000000000001", page: 1, limit: 20 };
const invalidUuid = "b4ce3816-3469-0039-9e3b-d020a24d3c9d";
afterEach(() => vi.restoreAllMocks());

describe("exact-user local Addon assignments", () => {
  it("preserves stored UUIDv4 references, historical parent UUID and precise revisions without a use grant", () => {
    const body = createAddonAssignmentsFixture(), row = body.data[0];
    for (const field of ["addonId", "addonSelectionId", "selectedDefinitionVersionId"] as const) row[field] = row[field].replace("-7777-", "-4777-");
    expect(parseApplicationAddonAssignments(body, request)).toEqual({ items: body.data, meta: body.meta });
  });
  it("accepts an existing canonical UUIDv4 user independently of new intent UUID rules", () => {
    const body = createAddonAssignmentsFixture(), userId = body.data[0].parentAssignmentId; body.data[0].userId = userId;
    expect(parseApplicationAddonAssignments(body, { ...request, userId }).items[0].userId).toBe(userId);
  });
  it.each(["other-user", "parent-owner", "revision-overflow", "zero-revision", "assigned-id-v4", "definition-version0", "addon-version0", "extra-profile", "price", "grant", "wrong-page", "total", "extra-meta", "duplicate", "invalid-timestamp", "bad-version"])("rejects %s", (kind) => {
    const body = createAddonAssignmentsFixture(), row = body.data[0];
    if (kind === "other-user") row.userId = row.addonId;
    if (kind === "parent-owner") row.addonKey = "trade.logistics";
    if (kind === "revision-overflow") row.allowanceRevision = "9223372036854775808";
    if (kind === "zero-revision") row.assignmentRevision = "0";
    if (kind === "assigned-id-v4") row.assignmentId = row.parentAssignmentId;
    if (kind === "definition-version0") row.selectedDefinitionVersionId = invalidUuid;
    if (kind === "addon-version0") row.addonId = invalidUuid;
    if (kind === "extra-profile") Object.assign(row, { email: "private@example.test" });
    if (kind === "price") Object.assign(row, { unitPrice: "10.0000" });
    if (kind === "grant") Object.assign(row, { operationalUse: "GRANTED" });
    if (kind === "wrong-page") body.meta.page = 2;
    if (kind === "total") body.meta.total = 2;
    if (kind === "extra-meta") Object.assign(body.meta, { cursor: "invented" });
    if (kind === "duplicate") { body.data.push({ ...row }); body.meta.total = 2; }
    if (kind === "invalid-timestamp") row.assignedAt = "yesterday";
    if (kind === "bad-version") Object.assign(row, { contractVersion: 1 });
    expect(() => parseApplicationAddonAssignments(body, request)).toThrow("could not be verified");
  });
  it("accepts a canonical empty allocation page and rejects extra envelope fields", () => {
    const body = createAddonAssignmentsFixture(); body.data = []; body.meta.total = 0; body.meta.totalPages = 0;
    expect(parseApplicationAddonAssignments(body, request).items).toEqual([]);
    expect(() => parseApplicationAddonAssignments({ ...body, contractVersion: 2 }, request)).toThrow();
  });
  it("sends only the canonical path and pagination with a1MiB bound", async () => {
    const spy = vi.spyOn(axiosClient, "get").mockResolvedValue({ data: createAddonAssignmentsFixture(), headers, status: 200, statusText: "OK" });
    await readApplicationAddonAssignments(request);
    expect(spy).toHaveBeenCalledExactlyOnceWith(`/api/tenant/core/v1/users/${request.userId}/addon-assignments?page=1&limit=20`, {
      signal: undefined, cache: "no-store", maxResponseBytes: 1_048_576,
    });
  });
  it("refuses an invalid target before making a request", async () => {
    const spy = vi.spyOn(axiosClient, "get");
    await expect(readApplicationAddonAssignments({ ...request, userId: "../other" })).rejects.toThrow(); expect(spy).not.toHaveBeenCalled();
  });
});
