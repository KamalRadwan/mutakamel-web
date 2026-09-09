import { describe, expect, it } from "vitest";
import type { LeadDetail } from "../lead-contract";
import { buildLeadDetailsRequest, leadDetailsInitials, parseLeadDetailsUser, toLeadDetailsForm } from "./lead-details-edit-contract";

const OWNER = "01900100-0000-7000-8000-000000000001";
const lead = { acquisitionSourceId: OWNER, ownerUserId: OWNER, interestSummary: "Summary", expectedNeed: "Need", description: "Note" } as LeadDetail;

describe("lead details contract", () => {
  it("sends changed fields only and never writable audit metadata", () => {
    const baseline = toLeadDetailsForm(lead);
    expect(buildLeadDetailsRequest({ ...baseline, description: " New note " }, baseline)).toEqual({ description: "New note" });
    expect(buildLeadDetailsRequest(baseline, baseline)).toEqual({});
  });
  it("clears source and text without clearing or inventing an owner", () => {
    const baseline = toLeadDetailsForm(lead);
    expect(buildLeadDetailsRequest({ ...baseline, acquisitionSourceId: "", interestSummary: "", ownerUserId: "" }, baseline)).toEqual({ acquisitionSourceId: null, interestSummary: "" });
  });
  it("uses the DTO owner field only when a valid owner changes", () => {
    const baseline = toLeadDetailsForm({ ...lead, ownerUserId: null });
    expect(buildLeadDetailsRequest({ ...baseline, ownerUserId: OWNER }, baseline)).toEqual({ ownerUserId: OWNER });
  });
  it("renders name initials and validates user identities", () => {
    expect(leadDetailsInitials("Kamal radwan")).toBe("KR");
    expect(leadDetailsInitials("  Kamal  Mohamed Radwan ")).toBe("KR");
    expect(leadDetailsInitials("")).toBe("");
    expect(parseLeadDetailsUser({ id: OWNER, firstName: "Kamal", lastName: "Radwan", avatarUrl: "ignored" })).toEqual({ id: OWNER, firstName: "Kamal", lastName: "Radwan" });
    expect(() => parseLeadDetailsUser({ id: "bad", firstName: "Kamal", lastName: "Radwan" })).toThrow();
  });
});
