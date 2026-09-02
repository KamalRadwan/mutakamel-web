import { describe, expect, it } from "vitest";
import { tenantSessionEndedHref } from "./sessionDestination";

describe("tenantSessionEndedHref", () => {
  it.each([
    "AUTH_SESSION_ENDED",
    "AUTH_SESSION_IDLE_EXPIRED",
    "AUTH_SESSION_ABSOLUTE_EXPIRED",
    "AUTH_SECURITY_STALE",
    "AUTH_SESSION_STALE",
    "INVALID_REFRESH_TOKEN",
  ])("names %s on the expiry screen", (code) => {
    expect(tenantSessionEndedHref(code)).toBe(
      `/session-expired?reason=${code}`,
    );
  });

  // The reason this mapper exists. Every other terminal code is a session that
  // ran out; this one is an account an administrator has to reinstate, and
  // /session-expired's only offer is to sign in again.
  it("routes an inactive identity to the suspended-account screen", () => {
    expect(tenantSessionEndedHref("SESSION_IDENTITY_INACTIVE")).toBe(
      "/account-suspended",
    );
  });

  it("claims no reason when none was observed", () => {
    expect(tenantSessionEndedHref(null)).toBe("/session-expired");
  });

  // The gate: a code outside the transport's own set selects nothing, so a
  // hand-edited value can neither pick a message nor pick a screen.
  it.each([
    "NOT_A_REAL_CODE",
    "session_identity_inactive",
    "__proto__",
    "constructor",
    "SESSION_IDENTITY_INACTIVE&reason=AUTH_SECURITY_STALE",
  ])("refuses %j", (code) => {
    expect(tenantSessionEndedHref(code)).toBe("/session-expired");
  });
});
