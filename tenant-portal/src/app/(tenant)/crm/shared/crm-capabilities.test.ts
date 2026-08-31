import { describe, expect, it } from "vitest";
import {
  crmCapabilityAllowsOwner,
  parseAttachedRecordCapabilities,
  parseCrmActionCapability,
} from "./crm-capabilities";

const OWNER = "01900100-0000-7000-8000-000000000020";
const OTHER_OWNER = "01900100-0000-7000-8000-000000000021";
const BRANCH = "01900100-0000-7000-8000-000000000099";

describe("CRM action capabilities", () => {
  it("reads an owner-bounded capability and an unbounded one", () => {
    expect(parseCrmActionCapability({ scope: "own", ownerUserIds: [OWNER] }, "leads")).toEqual({
      scope: "own",
      ownerUserIds: [OWNER],
    });
    expect(parseCrmActionCapability({ scope: "all", ownerUserIds: null }, "leads")).toEqual({
      scope: "all",
      ownerUserIds: null,
    });
  });

  it("treats null and undefined as unavailable rather than as an error", () => {
    expect(parseCrmActionCapability(null, "leads")).toBeNull();
    expect(parseCrmActionCapability(undefined, "leads")).toBeNull();
  });

  it("rejects a scope and boundary that disagree", () => {
    // `all` always pairs with a null boundary and `own`/`team` never do.
    expect(() =>
      parseCrmActionCapability({ scope: "all", ownerUserIds: [OWNER] }, "leads"),
    ).toThrow();
    expect(() =>
      parseCrmActionCapability({ scope: "own", ownerUserIds: null }, "leads"),
    ).toThrow();
  });

  it("rejects a malformed scope, a non-UUID owner and a duplicated owner", () => {
    expect(() => parseCrmActionCapability({ scope: "any", ownerUserIds: null }, "leads")).toThrow();
    expect(() => parseCrmActionCapability({ scope: "own", ownerUserIds: ["nope"] }, "leads")).toThrow();
    expect(() =>
      parseCrmActionCapability({ scope: "team", ownerUserIds: [OWNER, OWNER] }, "leads"),
    ).toThrow();
    expect(() => parseCrmActionCapability({ scope: "own", ownerUserIds: [] }, "leads")).toThrow();
  });

  it("admits an action only for a record inside the owner boundary", () => {
    const own = { scope: "own" as const, ownerUserIds: [OWNER] };
    expect(crmCapabilityAllowsOwner(own, OWNER)).toBe(true);
    // This is defect D11 in one assertion: the permission string
    // `crm.leads.update.own` would pass for this record too.
    expect(crmCapabilityAllowsOwner(own, OTHER_OWNER)).toBe(false);
    // An unowned record is outside an own/team boundary, never inside it.
    expect(crmCapabilityAllowsOwner(own, null)).toBe(false);
    expect(crmCapabilityAllowsOwner({ scope: "all", ownerUserIds: null }, null)).toBe(true);
    expect(crmCapabilityAllowsOwner(null, OWNER)).toBe(false);
  });
});

describe("notes and attachments capabilities from /leads/capabilities", () => {
  const payload = {
    branchId: BRANCH,
    leads: { create: null, update: null, delete: null, convert: null },
    activities: { create: null },
    notes: { create: { scope: "team", ownerUserIds: [OWNER] }, delete: null },
    attachments: { create: { scope: "all", ownerUserIds: null }, delete: null },
    opportunities: { create: null },
  };

  it("reads only the notes and attachments halves", () => {
    expect(parseAttachedRecordCapabilities(payload, BRANCH)).toEqual({
      notesCreate: { scope: "team", ownerUserIds: [OWNER] },
      notesDelete: null,
      attachmentsCreate: { scope: "all", ownerUserIds: null },
      attachmentsDelete: null,
    });
  });

  it("rejects a response for a different branch", () => {
    expect(() => parseAttachedRecordCapabilities(payload, OTHER_OWNER)).toThrow();
  });

  it("rejects a response missing either half", () => {
    expect(() =>
      parseAttachedRecordCapabilities({ ...payload, notes: undefined }, BRANCH),
    ).toThrow();
    expect(() =>
      parseAttachedRecordCapabilities({ ...payload, attachments: null }, BRANCH),
    ).toThrow();
  });
});
