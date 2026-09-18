import { describe, expect, it } from "vitest";
import { parseUserContactProfile } from "./user-profile";

const ID = "01900100-0000-7000-8000-000000000011";
const source = { id: ID, firstName: " Saly ", lastName: "Essam", email: "saly@example.com" };

describe("the user contact projection", () => {
  it("keeps only verified contact fields and never infers a phone, photo, or Party link", () => {
    expect(parseUserContactProfile({ ...source, phone: "+201000000000", avatarUrl: "/private.jpg",
      partyId: "01900100-0000-7000-8000-000000000012", permissions: ["users.user.read"], managerId: ID,
    }, ID)).toEqual({ id: ID, fullName: "Saly Essam", email: source.email, phone: null, imageUrl: null });
  });
  it.each([null, [], {}, { ...source, id: "01900100-0000-7000-8000-000000000012" },
    { ...source, firstName: null }, { ...source, firstName: "", lastName: " " },
    { ...source, email: null }, { ...source, firstName: ID, lastName: "" },
  ])("rejects malformed or mismatched people: %j", (payload) => {
    expect(() => parseUserContactProfile(payload, ID)).toThrow();
  });
});
