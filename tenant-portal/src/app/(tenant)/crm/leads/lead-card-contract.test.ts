import { describe, expect, it } from "vitest";
import {
  buildLeadCardPatchBody,
  leadActivityState,
  leadCardHeading,
  leadOwnerInitials,
  parseLeadTags,
} from "./lead-card-contract";

const OWNER_ID = "01900100-0000-7000-8000-000000000020";
const TAG_ID = "01900100-0000-7000-8000-0000000000a1";

describe("lead card contract", () => {
  // The shape that actually arrives for a corporate lead: CRM composes the
  // display name FROM the company name, so `leadName` and `company` are the
  // SAME string and only the contact tells the two card shapes apart. Keying
  // on their inequality collapsed every corporate card to one line — the
  // reported bug.
  it("titles a corporate lead by its company and names the contact underneath", () => {
    expect(
      leadCardHeading({
        leadName: "Acme Trading",
        company: "Acme Trading",
        primaryContactName: "Dina Ali",
      }),
    ).toEqual({ title: "Acme Trading", contactName: "Dina Ali" });
  });

  it("gives an individual lead one line, because its party has no contact", () => {
    expect(
      leadCardHeading({
        leadName: "Kamal Radwan",
        company: "Kamal Radwan",
        primaryContactName: "",
      }),
    ).toEqual({ title: "Kamal Radwan", contactName: null });
  });

  it("falls back to the lead name when a corporate lead has no company string", () => {
    expect(
      leadCardHeading({
        leadName: "Acme Trading",
        company: "",
        primaryContactName: "Dina Ali",
      }),
    ).toEqual({ title: "Acme Trading", contactName: "Dina Ali" });
  });

  it("takes one letter from each known name and none from an unknown one", () => {
    const owner = { userId: OWNER_ID, firstName: "Kamal", lastName: "Radwan" };
    expect(leadOwnerInitials(owner)).toBe("KR");
    expect(leadOwnerInitials({ ...owner, lastName: "" })).toBe("K");
    expect(leadOwnerInitials({ ...owner, firstName: " ", lastName: "  " })).toBe("");
    expect(leadOwnerInitials({ ...owner, firstName: "كمال", lastName: "رضوان" })).toBe("كر");
  });

  it("folds a lead with no open activity into its own bucket", () => {
    expect(leadActivityState(null)).toBe("NONE");
    expect(
      leadActivityState({ activityAt: "2026-09-05T09:00:00.000Z", bucket: "TODAY" }),
    ).toBe("TODAY");
  });

  it("sends only what changed, and can tell 'clear the colour' from 'leave it alone'", () => {
    expect(buildLeadCardPatchBody({ rating: 3 })).toEqual({ rating: 3 });
    expect(buildLeadCardPatchBody({ cardColor: null })).toEqual({ cardColor: null });
    expect(buildLeadCardPatchBody({ cardColor: "TEAL" })).toEqual({ cardColor: "TEAL" });
    // A rating of zero is a value, not an absence — the star the user pressed
    // to clear it has to reach the server.
    expect(buildLeadCardPatchBody({ rating: 0 })).toEqual({ rating: 0 });
    expect(buildLeadCardPatchBody({})).toEqual({});
  });

  describe("tags", () => {
    // Two different facts, one answer: a crm-app that does not project the
    // field yet, and a lead nobody has tagged. Neither is a broken payload.
    it("reads an absent, null or empty tag list as no tags", () => {
      expect(parseLeadTags(undefined)).toEqual([]);
      expect(parseLeadTags(null)).toEqual([]);
      expect(parseLeadTags([])).toEqual([]);
    });

    it("keeps the server's order and normalises the optional colour", () => {
      expect(
        parseLeadTags([
          { id: TAG_ID, name: "VIP", color: "RED" },
          { id: OWNER_ID, name: "Renewal" },
        ]),
      ).toEqual([
        { id: TAG_ID, name: "VIP", color: "RED" },
        { id: OWNER_ID, name: "Renewal", color: null },
      ]);
    });

    // Unlike `cardColor` — a CRM enum with a database CHECK behind it, where
    // an unknown value is a contract break — a tag's colour comes from a
    // vocabulary this screen does not own. It degrades to the neutral chip
    // rather than taking the whole board down.
    it("degrades an unrecognised colour instead of failing the list", () => {
      expect(parseLeadTags([{ id: TAG_ID, name: "VIP", color: "MAUVE" }])).toEqual([
        { id: TAG_ID, name: "VIP", color: null },
      ]);
    });

    it("rejects a payload of the wrong shape, as every parser here does", () => {
      expect(() => parseLeadTags("VIP")).toThrow();
      expect(() => parseLeadTags([{ id: TAG_ID }])).toThrow();
      expect(() => parseLeadTags([{ id: TAG_ID, name: "" }])).toThrow();
      expect(() => parseLeadTags([{ id: "not-a-uuid", name: "VIP" }])).toThrow();
      expect(() => parseLeadTags([{ id: TAG_ID, name: "VIP", color: 7 }])).toThrow();
    });
  });
});
