import { describe, expect, it } from "vitest";
import {
  classifyAuthFailure,
  isDefinitiveAuthFailure,
} from "./sessionErrors";

describe("tenant session failure classification", () => {
  it.each([
    [403, "FORBIDDEN", "forbidden"],
    [404, "NOT_FOUND", "retain"],
    [409, "CONFLICT", "retain"],
    [429, "RATE_LIMITED", "retain"],
    [503, "UNAVAILABLE", "retain"],
    [undefined, undefined, "retain"],
  ] as const)("classifies %s/%s as %s", (status, code, expected) => {
    expect(classifyAuthFailure(status, code)).toBe(expected);
  });

  it.each([
    [401, "AUTH_SESSION_ENDED"],
    [401, "AUTH_SESSION_IDLE_EXPIRED"],
    [401, "AUTH_SESSION_ABSOLUTE_EXPIRED"],
    [403, "AUTH_SECURITY_STALE"],
    [403, "SESSION_IDENTITY_INACTIVE"],
    [401, "INVALID_REFRESH_TOKEN"],
  ] as const)("ends only for the definitive %s/%s contract", (status, code) => {
    const error = { response: { status, data: { code } } };
    expect(classifyAuthFailure(status, code)).toBe("end");
    expect(isDefinitiveAuthFailure(error)).toBe(true);
  });

  it("does not treat an unclassified 401 as terminal", () => {
    const error = { response: { status: 401, data: { code: "TOKEN_EXPIRED" } } };
    expect(classifyAuthFailure(401, "TOKEN_EXPIRED")).toBe("refresh");
    expect(isDefinitiveAuthFailure(error)).toBe(false);
  });
});
