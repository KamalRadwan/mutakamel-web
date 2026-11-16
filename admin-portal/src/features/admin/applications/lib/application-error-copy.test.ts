import { describe, expect, it } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { localizeApplicationError } from "./application-error-copy";

const codes = [
  "APPLICATION_CATALOGUE_REVISION_STALE", "APPLICATION_PUBLICATION_REVISION_STALE",
  "APPLICATION_PUBLICATION_REQUIRED", "APPLICATION_LIFECYCLE_TRANSITION_INVALID",
  "APPLICATION_DELETE_NOT_CATALOGUE_ONLY", "APPLICATION_IN_USE",
  "APPLICATION_DISABLE_CONVERGENCE_UNAVAILABLE", "DB_SERVER_APPLICATION_NOT_AVAILABLE",
  "DB_SERVER_APPLICATION_REVISION_STALE", "DB_SERVER_APPLICATION_ALREADY_BOUND_OR_NEEDS_RECOVERY",
  "DB_SERVER_SECURITY_ADMIN_CREDENTIALS_REQUIRED", "DB_SERVER_APPLICATION_BOOTSTRAP_FAILED",
  "DB_SERVER_APPLICATION_BIND_DEFERRED", "TIER_IN_USE", "TIER_RANK_TAKEN",
] as const;

describe("application error copy", () => {
  it.each(codes)("localizes %s in both languages and retains diagnostics", (code) => {
    for (const t of [ar, en]) {
      const message = localizeApplicationError({
        isNormalized: true, httpStatus: 409, errorCode: code,
        message: "Server English", correlationId: "request-123",
      }, t);
      expect(message).toContain(t.applications.errors[code]);
      expect(message).not.toContain("Server English");
      expect(message).toContain(`\u2066${code}\u2069`);
      expect(message).toContain("\u2066request-123\u2069");
    }
    expect(ar.applications.errors[code]).toMatch(/[\u0600-\u06ff]/);
  });

  it("keeps dictionary keys in parity", () => {
    expect(Object.keys(ar.applications.errors).sort()).toEqual(Object.keys(en.applications.errors).sort());
    expect(Object.keys(ar.applications.notifications).sort()).toEqual(Object.keys(en.applications.notifications).sort());
  });

  it.each([ar, en])("falls back to server copy for an unknown bind code", (t) => {
    const message = localizeApplicationError({ code: "FUTURE_BIND_ERROR", message: "Server explanation" }, t);
    expect(message).toBe("Server explanation (\u2066FUTURE_BIND_ERROR\u2069)");
  });

  it("normalizes Core and Gateway envelopes without losing correlation IDs", () => {
    const code = "APPLICATION_PUBLICATION_REQUIRED";
    for (const data of [
      { success: false, errorCode: code, message: "English" },
      { code, title: "English" },
    ]) {
      expect(localizeApplicationError({ response: { status: 409, data, headers: { "x-correlation-id": "request-123" } } }, ar))
        .toBe(`${ar.applications.errors[code]} (\u2066${code}\u2069 · \u2066request-123\u2069)`);
    }
  });

  it("uses an unknown server error's message instead of the Axios wrapper message", () => {
    const error = Object.assign(new Error("Request failed with status code 409"), {
      response: { status: 409, data: { success: false, errorCode: "FUTURE_ERROR", message: "Server explanation" } },
    });
    expect(localizeApplicationError(error, ar)).toBe("Server explanation (\u2066FUTURE_ERROR\u2069)");
  });

  it("preserves ordinary Error messages and does not duplicate diagnostic suffixes", () => {
    expect(localizeApplicationError(new Error("Network interrupted"), ar)).toBe("Network interrupted");
    const error = { isNormalized: true, httpStatus: 503, errorCode: "FUTURE_ERROR", message: "Server explanation", correlationId: "request-123" };
    const once = localizeApplicationError(error, ar);
    expect(localizeApplicationError({ ...error, message: once }, ar)).toBe(once);
  });
});
