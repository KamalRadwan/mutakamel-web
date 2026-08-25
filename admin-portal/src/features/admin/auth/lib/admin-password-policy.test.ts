import { describe, expect, it } from "vitest";
import {
  ADMIN_ACTION_TOKEN_MAX_LENGTH,
  ADMIN_PASSWORD_MAX_LENGTH,
  getAdminPasswordChecks,
  isStrongAdminPassword,
  readAdminActionTokenFromHash,
  validateAdminPasswordAction,
} from "./admin-password-policy";

const validToken = "abcdefghijklmnop";

describe("admin one-time password action validation", () => {
  it("matches the Core strong-password policy", () => {
    expect(getAdminPasswordChecks("StrongPassword1!")).toEqual({
      length: true,
      lowercase: true,
      uppercase: true,
      number: true,
      symbol: true,
    });
    expect(isStrongAdminPassword("StrongPassword1!")).toBe(true);
    expect(isStrongAdminPassword("SHORT1!a")).toBe(false);
    expect(isStrongAdminPassword("NOLOWERCASE12!")).toBe(false);
    expect(isStrongAdminPassword("nouppercase12!")).toBe(false);
    expect(isStrongAdminPassword("NoNumberHere!")).toBe(false);
    expect(isStrongAdminPassword("NoSymbolHere12")).toBe(false);
    expect(isStrongAdminPassword(`Aa1!${"x".repeat(ADMIN_PASSWORD_MAX_LENGTH - 3)}`)).toBe(false);
  });

  it("validates exact DTO token bounds, password bounds, and confirmation", () => {
    expect(validateAdminPasswordAction({
      token: null,
      password: "StrongPassword1!",
      confirmation: "StrongPassword1!",
    })).toBe("tokenMissing");
    expect(validateAdminPasswordAction({
      token: "too-short",
      password: "StrongPassword1!",
      confirmation: "StrongPassword1!",
    })).toBe("tokenInvalid");
    expect(validateAdminPasswordAction({
      token: "x".repeat(ADMIN_ACTION_TOKEN_MAX_LENGTH + 1),
      password: "StrongPassword1!",
      confirmation: "StrongPassword1!",
    })).toBe("tokenInvalid");
    expect(validateAdminPasswordAction({
      token: validToken,
      password: "StrongPassword1!",
      confirmation: "different",
    })).toBe("confirmationMismatch");
    expect(validateAdminPasswordAction({
      token: validToken,
      password: "StrongPassword1!",
      confirmation: "StrongPassword1!",
    })).toBeNull();
  });

  it("reads only the token field from a URL fragment", () => {
    expect(readAdminActionTokenFromHash("#token=abc%2Bdef%2Fghi%3D%3D&ignored=1"))
      .toBe("abc+def/ghi==");
    expect(readAdminActionTokenFromHash("#ignored=1")).toBeNull();
    expect(readAdminActionTokenFromHash("")).toBeNull();
  });
});
