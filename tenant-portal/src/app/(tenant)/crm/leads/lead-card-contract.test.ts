import { describe, expect, it } from "vitest";
import {
  buildLeadCardPatchBody,
  leadActivityState,
  leadCardHeading,
  leadCountryIso,
  leadNameInitials,
  leadOwnerInitials,
} from "./lead-card-contract";
import { parseCrmTags } from "../shared/tag-contract";

const OWNER_ID = "01900100-0000-7000-8000-000000000020";
const TAG_ID = "01900100-0000-7000-8000-0000000000a1";

describe("lead card contract", () => {
  it("uses the same initials for display names, preserving Unicode characters", () => {
    expect(leadNameInitials("   ")).toBe("LD");
    expect(leadNameInitials("  Acme  ")).toBe("AC");
    expect(leadNameInitials("  Dina   Ali Hassan ")).toBe("DA");
    expect(leadNameInitials("كمال رضوان")).toBe("كر");
    expect(leadNameInitials("𐐀𐐁")).toBe("𐐀𐐁");
    expect(leadNameInitials("𐐀name 𐐁name")).toBe("𐐀𐐁");
  });

  it("resolves country codes and bilingual names without guessing unknown names", () => {
    expect(leadCountryIso(" eg ")).toBe("EG");
    expect(leadCountryIso("Egypt")).toBe("EG");
    expect(leadCountryIso("مصر")).toBe("EG");
    expect(leadCountryIso("Unknown country")).toBeNull();
    expect(leadCountryIso(" ")).toBeNull();
    expect(leadCountryIso(null)).toBeNull();
    expect(leadCountryIso(undefined)).toBeNull();
  });

  // The shape that actually arrives for a corporate lead: CRM composes the
  // display name FROM the company name, so `leadName` and `company` are the
  // SAME string and only the contact tells the two card shapes apart. Keying
  // on their inequality collapsed every corporate card to one line — the
  // reported bug.
  it("titles a corporate lead by its company and names the contact underneath", () => {
    expect(
      leadCardHeading({
        leadProfileType: "CORPORATE",
        leadName: "Acme Trading",
        company: "Acme Trading",
        primaryContact: { displayName: "Dina Ali" },
      }),
    ).toEqual({ title: "Acme Trading", contactName: "Dina Ali" });
  });

  it("gives an individual lead one line, because its party has no contact", () => {
    expect(
      leadCardHeading({
        leadProfileType: "INDIVIDUAL",
        leadName: "Kamal Radwan",
        company: "Kamal Radwan",
        primaryContact: null,
      }),
    ).toEqual({ title: "Kamal Radwan", contactName: null });
  });

  it("falls back to the lead name when a corporate lead has no company string", () => {
    expect(
      leadCardHeading({
        leadProfileType: "CORPORATE",
        leadName: "Acme Trading",
        company: "",
        primaryContact: { displayName: "Dina Ali" },
      }),
    ).toEqual({ title: "Acme Trading", contactName: "Dina Ali" });
  });

  it("has no contact heading when a corporate lead has no lead contact", () => {
    expect(leadCardHeading({
      leadProfileType: "CORPORATE",
      leadName: "Acme Trading",
      company: "Acme Trading",
      primaryContact: null,
    })).toEqual({ title: "Acme Trading", contactName: null });
  });

  it("takes one letter from each known name and none from an unknown one", () => {
    const owner = { userId: OWNER_ID, firstName: "Kamal", lastName: "Radwan" };
    expect(leadOwnerInitials(owner)).toBe("KR");
    expect(leadOwnerInitials({ ...owner, lastName: "" })).toBe("K");
    expect(leadOwnerInitials({ ...owner, firstName: " ", lastName: "  " })).toBe("");
    expect(leadOwnerInitials({ ...owner, firstName: "كمال", lastName: "رضوان" })).toBe("كر");
  });

  it("folds a lead with no open activity into its own bucket", () => {
    const now = new Date(2026, 9, 26, 12);
    expect(leadActivityState(null, now)).toBe("NONE");
  });

  it.each([
    [new Date(2026, 9, 25, 23, 59, 59, 999), "FUTURE", "OVERDUE"],
    [new Date(2026, 9, 26), "OVERDUE", "TODAY"],
    [new Date(2026, 9, 26, 9), "OVERDUE", "TODAY"],
    [new Date(2026, 9, 26, 12), "FUTURE", "TODAY"],
    [new Date(2026, 9, 26, 12, 0, 0, 1), "TODAY", "FUTURE"],
  ] as const)("uses timestamp %s over bucket %s to resolve %s", (due, bucket, state) => {
    const now = new Date(2026, 9, 26, 12);
    expect(leadActivityState({ activityAt: due.toISOString(), bucket }, now)).toBe(state);
  });

  it.each(["OVERDUE", "TODAY", "FUTURE"] as const)("falls back to %s for an unparsable activity date", (bucket) => {
    const now = new Date(2026, 9, 26, 12);
    expect(leadActivityState({ activityAt: "invalid-date", bucket }, now)).toBe(bucket);
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

  // The lead read model embeds the shared CRM tag summary, so its tags are
  // read through the one parser every CRM screen uses.
  describe("tags", () => {
    // Two different facts, one answer: a crm-app that does not project the
    // field yet, and a lead nobody has tagged. Neither is a broken payload.
    it("reads an absent, null or empty tag list as no tags", () => {
      expect(parseCrmTags(undefined)).toEqual([]);
      expect(parseCrmTags(null)).toEqual([]);
      expect(parseCrmTags([])).toEqual([]);
    });

    it("keeps the server's order and canonicalises the colour pair", () => {
      expect(
        parseCrmTags([
          { id: TAG_ID, name: "VIP", backgroundColor: "#fee2e2", textColor: "#991B1B" },
          { id: OWNER_ID, name: "Renewal", backgroundColor: null, textColor: null },
        ]),
      ).toEqual([
        { id: TAG_ID, name: "VIP", backgroundColor: "#FEE2E2", textColor: "#991B1B" },
        { id: OWNER_ID, name: "Renewal", backgroundColor: null, textColor: null },
      ]);
    });

    // The colour is cosmetic: a missing, half-set or malformed pair degrades
    // to the neutral chip rather than taking the whole board down.
    it("degrades a missing, half-set or malformed colour pair to uncoloured", () => {
      const uncoloured = [{ id: TAG_ID, name: "VIP", backgroundColor: null, textColor: null }];
      expect(parseCrmTags([{ id: TAG_ID, name: "VIP" }])).toEqual(uncoloured);
      expect(parseCrmTags([{ id: TAG_ID, name: "VIP", backgroundColor: "#FEE2E2", textColor: null }])).toEqual(uncoloured);
      expect(parseCrmTags([{ id: TAG_ID, name: "VIP", backgroundColor: "RED", textColor: 7 }])).toEqual(uncoloured);
    });

    it("rejects a payload of the wrong shape, as every parser here does", () => {
      expect(() => parseCrmTags("VIP")).toThrow();
      expect(() => parseCrmTags([{ id: TAG_ID }])).toThrow();
      expect(() => parseCrmTags([{ id: TAG_ID, name: "" }])).toThrow();
      expect(() => parseCrmTags([{ id: "not-a-uuid", name: "VIP" }])).toThrow();
      expect(() => parseCrmTags([{ id: TAG_ID, name: "VIP" }, { id: TAG_ID, name: "VIP" }])).toThrow();
    });
  });
});
