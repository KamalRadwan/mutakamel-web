import { describe, expect, it } from "vitest";
import {
  buildCustomerProfileCardPatchBody,
  parseCustomerProfileCardColor,
  parseCustomerProfileCardPatchResponse,
  parseCustomerProfileRating,
} from "./customer-profile-card-contract";

const PROFILE_ID = "0191e9a8-7f51-7b32-8d72-19f9217a41b3";
const BRANCH_ID = "0191e9a8-7f51-7b32-8d72-19f9217a41b4";

describe("customer profile card contract", () => {
  it("accepts the shared 0-3 rating and card-colour vocabulary", () => {
    expect(parseCustomerProfileRating(0)).toBe(0);
    expect(parseCustomerProfileRating(3)).toBe(3);
    expect(parseCustomerProfileCardColor("TEAL")).toBe("TEAL");
    expect(parseCustomerProfileCardColor(null)).toBeNull();
  });

  it("rejects out-of-range ratings and unknown colours", () => {
    expect(() => parseCustomerProfileRating(4)).toThrow();
    expect(() => parseCustomerProfileRating("2")).toThrow();
    expect(() => parseCustomerProfileCardColor("MAUVE")).toThrow();
  });

  it("sends only the card fields that changed", () => {
    expect(buildCustomerProfileCardPatchBody({ rating: 2 })).toEqual({
      rating: 2,
    });
    expect(buildCustomerProfileCardPatchBody({ cardColor: null })).toEqual({
      cardColor: null,
    });
  });

  it("validates the identity of the confirmed PATCH response", () => {
    expect(
      parseCustomerProfileCardPatchResponse(
        {
          id: PROFILE_ID,
          branchId: BRANCH_ID,
          rating: 2,
          cardColor: "TEAL",
        },
        PROFILE_ID,
        BRANCH_ID,
      ),
    ).toEqual({ rating: 2, cardColor: "TEAL" });

    expect(() =>
      parseCustomerProfileCardPatchResponse(
        { id: PROFILE_ID, branchId: BRANCH_ID, rating: 2 },
        "0191e9a8-7f51-7b32-8d72-19f9217a41b9",
        BRANCH_ID,
      ),
    ).toThrow();
  });
});
