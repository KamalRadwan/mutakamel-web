import { describe, expect, it } from "vitest";
import { parseLeadDetailCapabilities } from "./hooks/useLeadCapabilities";

const BRANCH = "01900100-0000-7000-8000-000000000099";
const OWNER = "01900100-0000-7000-8000-000000000020";

// The exact response `LeadsService.getCapabilities` builds — the one endpoint
// that reports notes and attachments alongside the lead actions.
const payload = {
  branchId: BRANCH,
  leads: {
    create: { scope: "team", ownerUserIds: [OWNER] },
    update: { scope: "own", ownerUserIds: [OWNER] },
    delete: null,
    convert: { scope: "all", ownerUserIds: null },
  },
  activities: { create: { scope: "team", ownerUserIds: [OWNER] } },
  notes: { create: { scope: "team", ownerUserIds: [OWNER] }, delete: null },
  attachments: { create: { scope: "team", ownerUserIds: [OWNER] }, delete: null },
  opportunities: { create: { scope: "all", ownerUserIds: null } },
};

describe("lead detail capabilities", () => {
  it("reads every action the detail screen gates on, in one call", () => {
    expect(parseLeadDetailCapabilities(payload, BRANCH)).toEqual({
      update: { scope: "own", ownerUserIds: [OWNER] },
      delete: null,
      convert: { scope: "all", ownerUserIds: null },
      opportunitiesCreate: { scope: "all", ownerUserIds: null },
      notesCreate: { scope: "team", ownerUserIds: [OWNER] },
      notesDelete: null,
      attachmentsCreate: { scope: "team", ownerUserIds: [OWNER] },
      attachmentsDelete: null,
    });
  });

  it("rejects a payload answered for a different branch", () => {
    expect(() => parseLeadDetailCapabilities(payload, OWNER)).toThrow();
  });

  it("rejects a payload missing the notes or attachments block", () => {
    expect(() =>
      parseLeadDetailCapabilities({ ...payload, notes: undefined }, BRANCH),
    ).toThrow();
    expect(() =>
      parseLeadDetailCapabilities({ ...payload, attachments: undefined }, BRANCH),
    ).toThrow();
    expect(() =>
      parseLeadDetailCapabilities({ ...payload, leads: undefined }, BRANCH),
    ).toThrow();
  });
});
