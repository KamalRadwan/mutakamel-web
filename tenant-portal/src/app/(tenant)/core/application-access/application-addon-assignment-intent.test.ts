// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAddonAssignmentOptionsFixture } from "./application-addon-assignment-options.fixture";
import { createAddonAssignmentsFixture } from "./application-addon-assignments.fixture";
import { addonAssignmentCommandSchema } from "./application-addon-assignment-command";
import { captureAddonAssignmentDraft, clearAddonAssignmentIntent, listAddonAssignmentIntents, readAddonAssignmentIntent, retainAddonAssignmentIntent,
  type AddonAssignmentSource } from "./application-addon-assignment-intent";

const id = (n: number) => `018ef54e-2222-7777-8888-${String(n).padStart(12, "0")}`;
const option = () => createAddonAssignmentOptionsFixture().data[0];
const row = option(), context = { actorId: id(90), userId: row.userId, addonSelectionId: row.addonSelectionId };
const key = `tenant-addon-intent:${context.actorId}:${context.userId}:${context.addonSelectionId}`;
const command = () => addonAssignmentCommandSchema.parse({ ...captureAddonAssignmentDraft(row.userId, { kind: "OPTION", row }), idempotencyKey: id(91) });
beforeEach(() => window.sessionStorage.clear());
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("real browser-tab original-intent retention", () => {
  it("retains only the closed non-secret command/context and refuses a changed original intent", () => {
    const intent = command(); retainAddonAssignmentIntent(context, intent);
    expect(readAddonAssignmentIntent(context)).toEqual(intent);
    expect(Object.keys(JSON.parse(window.sessionStorage.getItem(key)!))).toEqual(["actorId", "userId", "addonSelectionId", "command"]);
    expect(window.sessionStorage.getItem(key)).not.toMatch(/token|cookie|password|price|permission|authorizationVersion/);
    retainAddonAssignmentIntent(context, intent);
    expect(() => retainAddonAssignmentIntent(context, { ...intent, idempotencyKey: id(92) })).toThrow();
    expect(readAddonAssignmentIntent(context)).toEqual(intent);
  });
  it("cannot recover an intent for a different actor, target or selection", () => {
    retainAddonAssignmentIntent(context, command());
    expect(readAddonAssignmentIntent({ ...context, actorId: id(10) })).toBeNull();
    expect(readAddonAssignmentIntent({ ...context, userId: id(11) })).toBeNull();
    expect(readAddonAssignmentIntent({ ...context, addonSelectionId: id(12) })).toBeNull();
    expect(() => retainAddonAssignmentIntent({ ...context, userId: id(11) }, command())).toThrow();
    expect(() => retainAddonAssignmentIntent({ ...context, addonSelectionId: id(12) }, command())).toThrow();
  });
  it("clears only the matching definitively resolved intent", () => {
    const intent = command(); retainAddonAssignmentIntent(context, intent);
    expect(() => clearAddonAssignmentIntent(context, { ...intent, idempotencyKey: id(92) })).toThrow();
    expect(readAddonAssignmentIntent(context)).toEqual(intent);
    clearAddonAssignmentIntent(context, intent); expect(readAddonAssignmentIntent(context)).toBeNull();
  });
  it.each(["{", "null", "[]", "x".repeat(4097)])("fails closed on corrupt stored data", (value) => {
    window.sessionStorage.setItem(key, value);
    expect(() => readAddonAssignmentIntent(context)).toThrow(); expect(() => retainAddonAssignmentIntent(context, command())).toThrow();
    expect(window.sessionStorage.getItem(key)).toBe(value);
  });
  it.each(["actorId", "userId", "addonSelectionId"])("rejects copied recovery context %s", (field) => {
    retainAddonAssignmentIntent(context, command()); const stored = JSON.parse(window.sessionStorage.getItem(key)!);
    stored[field] = id(99); window.sessionStorage.setItem(key, JSON.stringify(stored));
    expect(() => readAddonAssignmentIntent(context)).toThrow();
  });
  it("rejects additional stored keys and malformed nested CAS instead of repairing them", () => {
    const stored = { ...context, command: command(), extra: true }; window.sessionStorage.setItem(key, JSON.stringify(stored));
    expect(() => readAddonAssignmentIntent(context)).toThrow();
    const invalid = command(); if (invalid.operationKind === "ASSIGN_ADDON") invalid.body.expectedAllowanceRevision = "0";
    window.sessionStorage.setItem(key, JSON.stringify({ ...context, command: invalid })); expect(() => readAddonAssignmentIntent(context)).toThrow();
  });
  it("fails before submission when actual browser storage is unavailable or quota-limited", () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("Quota", "QuotaExceededError"); });
    expect(() => retainAddonAssignmentIntent(context, command())).toThrow("could not be retained safely");
  });
  it("does not crash on SSR reads, but cannot pretend to retain an intent without a browser", () => {
    vi.stubGlobal("window", undefined); expect(readAddonAssignmentIntent(context)).toBeNull();
    expect(() => retainAddonAssignmentIntent(context, command())).toThrow();
  });
  it("retains and removes the original child even when the current option has no child", () => {
    const selected = option(); selected.assignment = { id: id(5), revision: "8" };
    const original = addonAssignmentCommandSchema.parse({ ...captureAddonAssignmentDraft(selected.userId, { kind: "OPTION", row: selected }), idempotencyKey: id(91) });
    retainAddonAssignmentIntent(context, original); selected.assignment = null; selected.allowanceRevision = "99";
    expect(readAddonAssignmentIntent(context)).toMatchObject({ assignmentId: id(5), query: { expectedAssignmentRevision: "8", expectedAllowanceRevision: row.allowanceRevision } });
  });
  it("lists only this actor and user's schema-validated recovery identities, without current-row membership", () => {
    retainAddonAssignmentIntent(context, command());
    expect(listAddonAssignmentIntents(context.actorId, context.userId)).toEqual([{ kind: "RECOVERY", row: { userId: context.userId, addonSelectionId: context.addonSelectionId } }]);
    expect(listAddonAssignmentIntents(id(10), context.userId)).toEqual([]); expect(listAddonAssignmentIntents(context.actorId, id(10))).toEqual([]);
    expect(captureAddonAssignmentDraft(context.userId, listAddonAssignmentIntents(context.actorId, context.userId)[0])).toBeNull();
  });
  it("does not mistake failed storage reads for absence and overwrite a retained original", () => {
    const original = command(); retainAddonAssignmentIntent(context, original);
    const set = vi.spyOn(Storage.prototype, "setItem"), get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new DOMException("Denied", "SecurityError"); });
    expect(() => retainAddonAssignmentIntent(context, { ...original, idempotencyKey: id(92) })).toThrow(); expect(set).not.toHaveBeenCalled();
    get.mockRestore(); expect(readAddonAssignmentIntent(context)).toEqual(original);
  });
});

describe("command inputs from verified current reads, never eligibility", () => {
  it("uses the current exact-user assignment list's own child and local allowance CAS", () => {
    const selected = createAddonAssignmentsFixture().data[0];
    expect(captureAddonAssignmentDraft(selected.userId, { kind: "ASSIGNMENT", row: selected })).toEqual({ operationKind: "UNASSIGN_ADDON", userId: selected.userId,
      assignmentId: selected.assignmentId, query: { expectedAssignmentRevision: selected.assignmentRevision, expectedAllowanceRevision: selected.allowanceRevision } });
  });
  it("requires the exact user, active target and genuinely present parent for new assignment", () => {
    const selected = option(), source: AddonAssignmentSource = { kind: "OPTION", row: selected };
    expect(captureAddonAssignmentDraft(id(99), source)).toBeNull();
    selected.targetActive = false; expect(captureAddonAssignmentDraft(selected.userId, source)).toBeNull();
    selected.targetActive = true; selected.parentAssignment = null; expect(captureAddonAssignmentDraft(selected.userId, source)).toBeNull();
  });
  it("does not convert diagnostics into an eligibility grant or block inactive cleanup", () => {
    const selected = option(); selected.localState = { parentReadiness: "BLOCKED", addonReadiness: "NOT_READY", parentDenied: true, addonDenied: true, adoptionPending: true, capacityChangePending: true };
    const source: AddonAssignmentSource = { kind: "OPTION", row: selected };
    expect(captureAddonAssignmentDraft(selected.userId, source)?.operationKind).toBe("ASSIGN_ADDON");
    selected.targetActive = false; selected.assignment = { id: id(5), revision: "4" };
    expect(captureAddonAssignmentDraft(selected.userId, source)).toEqual({ operationKind: "UNASSIGN_ADDON", userId: selected.userId, assignmentId: id(5),
      query: { expectedAssignmentRevision: "4", expectedAllowanceRevision: selected.allowanceRevision } });
  });
});
