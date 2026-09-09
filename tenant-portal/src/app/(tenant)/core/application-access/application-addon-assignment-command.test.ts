import { afterEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "@/lib/api/axiosClient";
import { sendAddonAssignmentCommand, type AddonAssignmentCommand } from "./application-addon-assignment-command";

const id = (n: number) => `018ef54e-2222-7777-8888-${String(n).padStart(12, "0")}`;
const headers = new Headers();
function assign(): Extract<AddonAssignmentCommand, { operationKind: "ASSIGN_ADDON" }> { return { operationKind: "ASSIGN_ADDON", userId: id(1), idempotencyKey: id(2),
  body: {  addonSelectionId: id(3), expectedAllowanceRevision: "9223372036854775807", expectedParentAssignmentRevision: "2" } }; }
function remove(): Extract<AddonAssignmentCommand, { operationKind: "UNASSIGN_ADDON" }> { return { operationKind: "UNASSIGN_ADDON", userId: id(1), idempotencyKey: id(2), assignmentId: id(4),
  query: { expectedAssignmentRevision: "3", expectedAllowanceRevision: "9223372036854775807" } }; }
function response(command: AddonAssignmentCommand, changed = true) {
  return { status: command.operationKind === "ASSIGN_ADDON" ? 201 : 200, statusText: "OK", headers,
    data: { success: true, correlationId: "test", timestamp: "2026-09-08T10:00:01.000Z", data: { 
      operationId: id(5), operationRevision: "1", state: "COMMITTED", operationKind: command.operationKind,
      changed, resourceId: id(4), resourceRevision: "4", completedAt: "2026-09-08T10:00:00.000Z" } } };
}
afterEach(() => vi.restoreAllMocks());
describe("unmounted exact Addon assignment transport", () => {
  it.each([true, false])("sends only the exact POST body and original headers, changed=%s", async (changed) => {
    const input = assign(), reply = response(input, changed), signal = new AbortController().signal;
    const spy = vi.spyOn(axiosClient, "post").mockResolvedValue(reply);
    await expect(sendAddonAssignmentCommand(input, signal)).resolves.toEqual(reply.data.data);
    expect(spy).toHaveBeenCalledExactlyOnceWith(`/api/tenant/core/v1/users/${input.userId}/addon-assignments`, "body" in input ? input.body : undefined,
      { signal, cache: "no-store", headers: { "x-idempotency-key": input.idempotencyKey } });
  });
  it.each([true, false])("sends bodyless DELETE with only the original two revisions, changed=%s", async (changed) => {
    const input = remove(), reply = response(input, changed), signal = new AbortController().signal;
    const spy = vi.spyOn(axiosClient, "delete").mockResolvedValue(reply);
    await expect(sendAddonAssignmentCommand(input, signal)).resolves.toEqual(reply.data.data);
    expect(spy).toHaveBeenCalledExactlyOnceWith(`/api/tenant/core/v1/users/${id(1)}/addon-assignments/${id(4)}?expectedAssignmentRevision=3&expectedAllowanceRevision=9223372036854775807`,
      { signal, cache: "no-store", headers: { "x-idempotency-key": id(2) } });
    expect(spy.mock.calls[0][1]).not.toHaveProperty("body");
  });
  it("preserves a supported historical user UUID but never a historical intent key", async () => {
    const input = assign(); input.userId = "b4ce3816-3469-4039-9e3b-d020a24d3c9d";
    const spy = vi.spyOn(axiosClient, "post").mockResolvedValue(response(input)); await sendAddonAssignmentCommand(input);
    input.idempotencyKey = input.userId; await expect(sendAddonAssignmentCommand(input)).rejects.toThrow(); expect(spy).toHaveBeenCalledTimes(1);
  });
  it.each(["userId", "idempotencyKey"])("rejects malformed %s before transport", async (key) => {
    const spy = vi.spyOn(axiosClient, "post"), input = assign(); Object.assign(input, { [key]: "../foreign" });
    await expect(sendAddonAssignmentCommand(input)).rejects.toThrow(); expect(spy).not.toHaveBeenCalled();
  });
  it.each([0, "0", "01", "9223372036854775808", null])("refuses fabricated POST/DELETE CAS %s before transport", async (revision) => {
    const input = assign(), deletion = remove(), post = vi.spyOn(axiosClient, "post"), del = vi.spyOn(axiosClient, "delete");
    if ("body" in input) Object.assign(input.body, { expectedParentAssignmentRevision: revision });
    if ("query" in deletion) Object.assign(deletion.query, { expectedAssignmentRevision: revision });
    await expect(sendAddonAssignmentCommand(input)).rejects.toThrow(); await expect(sendAddonAssignmentCommand(deletion)).rejects.toThrow();
    expect(post).not.toHaveBeenCalled(); expect(del).not.toHaveBeenCalled();
  });
  it("rejects extra top-level/POST fields and DELETE contractVersion or body", async () => {
    const post = vi.spyOn(axiosClient, "post"), del = vi.spyOn(axiosClient, "delete");
    const scoped = { ...assign(), companyId: id(8) };
    await expect(sendAddonAssignmentCommand(scoped)).rejects.toThrow();
    const input = assign(); if ("body" in input) Object.assign(input.body, { seats: 1 });
    await expect(sendAddonAssignmentCommand(input)).rejects.toThrow();
    const deletion = remove(); if ("query" in deletion) Object.assign(deletion.query, { contractVersion: 2 });
    await expect(sendAddonAssignmentCommand(deletion)).rejects.toThrow();
    const withBody = { ...remove(), body: {} };
    await expect(sendAddonAssignmentCommand(withBody)).rejects.toThrow();
    expect(post).not.toHaveBeenCalled(); expect(del).not.toHaveBeenCalled();
  });
  it("does not retry or replace the original key after a transport failure", async () => {
    const input = assign(), spy = vi.spyOn(axiosClient, "post").mockRejectedValue(new Error("lost response"));
    await expect(sendAddonAssignmentCommand(input)).rejects.toThrow("lost response"); expect(spy).toHaveBeenCalledTimes(1);
    spy.mockResolvedValue(response(input)); await sendAddonAssignmentCommand(input);
    expect(spy.mock.calls[0]).toEqual(spy.mock.calls[1]);
  });
  it("does not accept a removed discriminator, wrong status or a different retained removal target", async () => {
    const input = remove(), spy = vi.spyOn(axiosClient, "delete");
    const versioned = response(input); Object.assign(versioned.data.data, { contractVersion: 2 });
    spy.mockResolvedValue(versioned); await expect(sendAddonAssignmentCommand(input)).rejects.toThrow();
    spy.mockResolvedValue({ ...response(input), status: 204 }); await expect(sendAddonAssignmentCommand(input)).rejects.toThrow();
    const reply = response(input); reply.data.data.resourceId = id(9); spy.mockResolvedValue(reply);
    await expect(sendAddonAssignmentCommand(input)).rejects.toThrow();
  });
});
