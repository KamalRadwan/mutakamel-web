import { describe, expect, it, vi } from "vitest";
import { parseApplicationAddonAssignmentReceipt } from "./application-addon-assignment-receipt";

const id = (suffix: number) => `018ef54e-2222-7777-8888-${String(suffix).padStart(12, "0")}`;
const assign = { operationKind: "ASSIGN_ADDON" } as const;
const remove = { operationKind: "UNASSIGN_ADDON", assignmentId: id(2) } as const;
function fixture(operationKind: "ASSIGN_ADDON" | "UNASSIGN_ADDON" = "ASSIGN_ADDON") {
  return { success: true, data: {  operationId: id(1), operationRevision: "1", state: "COMMITTED", operationKind,
    changed: true, resourceId: id(2), resourceRevision: "3", completedAt: "2026-09-08T10:00:00.123Z" },
  correlationId: "receipt-contract", timestamp: "2026-09-08T10:00:01.000Z" };
}
const parse = (body: unknown) => parseApplicationAddonAssignmentReceipt(body, 201, assign);

describe("Addon assignment receipts: historical terminal evidence only", () => {
  it.each([true, false])("accepts original ASSIGN201 with changed=%s and only the eight historical fields", (changed) => {
    const body = fixture(); body.data.changed = changed;
    const result = parse(body);
    expect(result).toEqual(body.data); expect(Object.isFrozen(result)).toBe(true);
    expect(Object.keys(result)).toHaveLength(8);
    expect(result).not.toHaveProperty("replayed"); expect(result).not.toHaveProperty("operationalUse");
  });
  it.each([true, false])("accepts REMOVE200 with changed=%s against its independently known assignment", (changed) => {
    const body = fixture("UNASSIGN_ADDON"); body.data.changed = changed;
    expect(parseApplicationAddonAssignmentReceipt(body, 200, remove)).toEqual(body.data);
    expect(() => parseApplicationAddonAssignmentReceipt(body, 200, { ...remove, assignmentId: id(3) })).toThrow();
  });
  it("accepts positive revisions beyond writer1 and preserves maximum bigint exactly", () => {
    const body = fixture(); body.data.operationRevision = "2"; body.data.resourceRevision = "9223372036854775807";
    expect(parse(body)).toMatchObject({ operationRevision: "2", resourceRevision: "9223372036854775807" });
    body.data.operationRevision = "9223372036854775807"; expect(parse(body).operationRevision).toBe(body.data.operationRevision);
  });
  it.each([true, false])("preserves replay's original changed=%s, IDs, revisions and terminal time", (changed) => {
    const body = fixture(); body.data.changed = changed; const original = parse(body);
    body.timestamp = "2026-09-09T14:00:00.000Z"; body.correlationId = "later-response";
    expect(parse(body)).toEqual(original);
    expect(parse(body).completedAt).toBe("2026-09-08T10:00:00.123Z");
  });
  it("does not invent ordering/equality rules for the envelope and terminal timestamps", () => {
    const body = fixture(); body.timestamp = "2026-09-07T10:00:00+03:00";
    expect(parse(body).completedAt).toBe(body.data.completedAt);
  });
  it.each([undefined, null, [], true, "receipt"]) ("refuses a non-object envelope: %s", (body) => {
    expect(() => parse(body)).toThrow("could not be verified");
  });
  it.each(["success", "data", "correlationId", "timestamp"])("requires envelope key %s", (key) => {
    const body: Record<string, unknown> = fixture(); delete body[key]; expect(() => parse(body)).toThrow();
  });
  it.each(Object.keys(fixture().data))("requires receipt key %s", (key) => {
    const body = fixture(); delete (body.data as Record<string, unknown>)[key]; expect(() => parse(body)).toThrow();
  });
  it.each([
    ["contractVersion", 1], ["contractVersion", "2"], ["operationId", id(1).replace("-7777-", "-4777-")],
    ["operationId", id(1).toUpperCase()], ["resourceId", id(2).replace("-7777-", "-4777-")], ["resourceId", "selection-id"],
    ["operationRevision", "0"], ["operationRevision", "01"], ["operationRevision", 1], ["operationRevision", "9223372036854775808"],
    ["resourceRevision", "0"], ["resourceRevision", "01"], ["resourceRevision", 3], ["resourceRevision", "9223372036854775808"],
    ["resourceRevision", "-1"], ["resourceRevision", "1.0"], ["resourceRevision", "1e1"], ["resourceRevision", " 1"],
    ["state", "PENDING"], ["state", "FAILED"], ["changed", "false"], ["changed", null],
    ["operationKind", "REMOVE_ADDON"], ["operationKind", "SET_APPLICATION_ACTIVATION"], ["operationKind", "SET_ADDON_ACTIVATION"],
    ["operationKind", "SET_BRANCH_OVERRIDE"], ["operationKind", "SET_COMPANY_CONFIGURATION"], ["operationKind", "SET_BRANCH_CONFIGURATION"],
    ["completedAt", "yesterday"], ["completedAt", "2026-09-08T10:00:00Z"], ["completedAt", "2026-09-08T10:00:00.1230Z"],
    ["completedAt", "2026-09-08T13:00:00.123+03:00"], ["completedAt", "2026-02-30T10:00:00.123Z"],
    ["tenantId", id(4)], ["userId", id(5)], ["replayed", true], ["ready", true], ["quantity", 10], ["price", "10.0000"],
  ])("rejects invalid or extra receipt field %s=%s", (key, value) => {
    const body = fixture(); Object.assign(body.data, { [String(key)]: value }); expect(() => parse(body)).toThrow("could not be verified");
  });
  it.each([
    ["success", false], ["data", null], ["data", []], ["correlationId", "x".repeat(37)], ["correlationId", 1],
    ["timestamp", "yesterday"], ["timestamp", "2026-09-08T10:00:01.000000000000Z"], ["meta", {}], ["pagination", {}],
  ])("rejects invalid or extra envelope field %s", (key, value) => {
    const body = fixture(); Object.assign(body, { [String(key)]: value }); expect(() => parse(body)).toThrow();
  });
  it.each([200, 202, 204, 400, 403])("refuses ASSIGN status%s even with a valid body", (status) => {
    expect(() => parseApplicationAddonAssignmentReceipt(fixture(), status, assign)).toThrow();
  });
  it.each([201, 202, 204, 400, 403])("refuses REMOVE status%s even with a valid body", (status) => {
    expect(() => parseApplicationAddonAssignmentReceipt(fixture("UNASSIGN_ADDON"), status, remove)).toThrow();
  });
  it.each([null, "1", "02", "2, 2"])("rejects a removed contract discriminator: %s", (version) => {
    const body = fixture(); Object.assign(body.data, { contractVersion: version });
    expect(() => parseApplicationAddonAssignmentReceipt(body, 201, assign)).toThrow();
  });
  it("rejects cross-operation receipts and fabricated expected assignment contexts", () => {
    expect(() => parseApplicationAddonAssignmentReceipt(fixture("UNASSIGN_ADDON"), 201, assign)).toThrow();
    expect(() => parseApplicationAddonAssignmentReceipt(fixture(), 200, remove)).toThrow();
    expect(() => parseApplicationAddonAssignmentReceipt(fixture("UNASSIGN_ADDON"), 200, { ...remove, assignmentId: "" })).toThrow();
    const invented = { ...assign, assignmentId: id(2) };
    expect(() => parseApplicationAddonAssignmentReceipt(fixture(), 201, invented)).toThrow();
  });
  it("rejects inherited, hidden, symbolic and accessor properties without invoking a getter", () => {
    const inherited = Object.create(fixture()); expect(() => parse(inherited)).toThrow();
    const hidden = fixture(); Object.defineProperty(hidden.data, "state", { enumerable: false }); expect(() => parse(hidden)).toThrow();
    const symbolic = fixture(); Object.assign(symbolic.data, { [Symbol("extra")]: true }); expect(() => parse(symbolic)).toThrow();
    const accessor = fixture(), getter = vi.fn(() => accessor.data);
    const unsafe = { ...accessor }; Object.defineProperty(unsafe, "data", { enumerable: true, get: getter });
    expect(() => parse(unsafe)).toThrow(); expect(getter).not.toHaveBeenCalled();
    const nested = fixture(), nestedGetter = vi.fn(() => "COMMITTED");
    Object.defineProperty(nested.data, "state", { enumerable: true, get: nestedGetter });
    expect(() => parse(nested)).toThrow(); expect(nestedGetter).not.toHaveBeenCalled();
  });
  it("accepts the exact correlation bound without treating it as the intent key", () => {
    const body = fixture(); body.correlationId = "x".repeat(36); expect(parse(body)).toEqual(body.data);
    body.correlationId = ""; expect(parse(body)).toEqual(body.data);
  });
  it("never includes unknown response values in its verification error", () => {
    const body = fixture(); Object.assign(body.data, { secret: "private-data-do-not-echo" });
    expect(() => parse(body)).toThrow(/^The Addon assignment result could not be verified\.$/);
  });
});
