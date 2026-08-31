import { describe, expect, it } from "vitest";
import { meetsPasswordPolicy } from "./useActionTokenPassword";

// PASSWORD_POLICY in core-app/src/common/security/password-policy.ts: at least
// 12 characters with one lower-case, one upper-case, one digit and one symbol.
// The DTO caps it at 128. Getting any of these wrong sends the user a 422 they
// cannot act on, because the server does not say which rule failed.
describe("meetsPasswordPolicy", () => {
  it("accepts a password that satisfies every rule", () => {
    expect(meetsPasswordPolicy("Str0ng-Passw0rd!")).toBe(true);
  });

  it.each([
    ["Sh0rt-Pw!", "shorter than 12"],
    ["alllowercase1!", "no upper-case letter"],
    ["ALLUPPERCASE1!", "no lower-case letter"],
    ["NoDigitsHere!!", "no digit"],
    ["NoSymbolsHere12", "no symbol"],
  ])("rejects %s — %s", (candidate) => {
    expect(meetsPasswordPolicy(candidate)).toBe(false);
  });

  it("rejects a password past the DTO's 128-character maximum", () => {
    expect(meetsPasswordPolicy(`Aa1!${"x".repeat(125)}`)).toBe(false);
  });
});
