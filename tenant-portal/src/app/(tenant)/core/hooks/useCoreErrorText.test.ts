// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import type { NormalizedApiError } from "@/lib/api/errors";

const { currentDictionaryRef } = vi.hoisted(() => ({
  currentDictionaryRef: { current: null as unknown },
}));

vi.mock("@/i18n/I18nContext", () => ({
  useI18n: () => ({
    t: currentDictionaryRef.current,
    lang: "en",
    dir: "ltr",
    setLang: vi.fn(),
    toggleLang: vi.fn(),
  }),
}));

import { resolveCoreErrorText, useCoreErrorText } from "./useCoreErrorText";

const CORR_ID = "0199f2b0-9999-7888-8777-666655554444";

function apiError(overrides: Partial<NormalizedApiError> & { status: number }): NormalizedApiError {
  return {
    message: "RAW_INTERNAL_SERVER_DIAGNOSTIC",
    ...overrides,
  };
}

describe("useCoreErrorText", () => {
  beforeEach(() => {
    currentDictionaryRef.current = en;
  });

  it("returns undefined when there is no error and narrows to string for NormalizedApiError callers", () => {
    const { result } = renderHook(() => useCoreErrorText());
    const strictDescribeError: (error: NormalizedApiError) => string = result.current;
    expect(result.current(null)).toBeUndefined();
    expect(result.current(undefined)).toBeUndefined();
    expect(resolveCoreErrorText(null, ar)).toBeUndefined();
    expect(typeof strictDescribeError(apiError({ status: 403 }))).toBe("string");
  });

  it("prioritizes cross-cutting Gateway outcomes (429, limiter down, idempotency) and keeps correlationId", () => {
    const rateLimited = resolveCoreErrorText(
      apiError({ status: 429, code: "GW.RATE.LIMIT_EXCEEDED", correlationId: CORR_ID }),
      en,
    );
    expect(rateLimited).toContain(en.errors.rateLimitedTitle);
    expect(rateLimited).toContain(en.errors.rateLimitedDescription);
    expect(rateLimited).toContain(CORR_ID);
    expect(rateLimited).not.toContain("RAW_INTERNAL_SERVER_DIAGNOSTIC");

    const limiterDown = resolveCoreErrorText(
      apiError({ status: 503, code: "GW.RATE.UNAVAILABLE", correlationId: CORR_ID }),
      ar,
    );
    expect(limiterDown).toContain(ar.errors.limiterUnavailableTitle);
    expect(limiterDown).toContain(ar.errors.limiterUnavailableDescription);
    expect(limiterDown).toContain(CORR_ID);

    const replayInFlight = resolveCoreErrorText(
      apiError({ status: 409, code: "IDEMPOTENCY_REQUEST_PROCESSING", correlationId: CORR_ID }),
      en,
    );
    expect(replayInFlight).toContain(en.errors.idempotencyProcessingTitle);
    expect(replayInFlight).toContain(en.errors.idempotencyProcessingDescription);
    expect(replayInFlight).toContain(CORR_ID);

    const gatewayInFlight = resolveCoreErrorText(
      apiError({ status: 409, code: "GW.IDEM.IN_FLIGHT", correlationId: CORR_ID }),
      ar,
    );
    expect(gatewayInFlight).toContain(ar.errors.idempotencyProcessingTitle);
    expect(gatewayInFlight).toContain(CORR_ID);

    const bodyMismatch = resolveCoreErrorText(
      apiError({ status: 422, code: "IDEMPOTENCY_BODY_MISMATCH", correlationId: CORR_ID }),
      ar,
    );
    expect(bodyMismatch).toContain(ar.errors.idempotencyMismatchTitle);
    expect(bodyMismatch).toContain(ar.errors.idempotencyMismatchDescription);
    expect(bodyMismatch).toContain(CORR_ID);
  });

  it("retains the CURRENT_PASSWORD_INVALID mapping to mfa.errors.currentPassword in both languages", () => {
    expect(
      resolveCoreErrorText(apiError({ status: 401, code: "CURRENT_PASSWORD_INVALID" }), en),
    ).toContain(en.mfa.errors.currentPassword);
    expect(
      resolveCoreErrorText(apiError({ status: 401, code: "CURRENT_PASSWORD_INVALID" }), ar),
    ).toContain(ar.mfa.errors.currentPassword);
  });

  it("maps current Core permission, quota, conflict, role, module, and invitation codes in English and Arabic", () => {
    const codes = [
      "USER_LIMIT_REACHED",
      "SEAT_LIMIT_REACHED",
      "ADDON_ASSIGNMENTS_EXIST",
      "APPLICATION_ALLOWANCE_STALE",
      "APPLICATION_ALLOWANCE_UNAVAILABLE",
      "TENANT_USER_ASSIGNMENTS_CHANGED",
      "INVITE_EMAIL_UNDELIVERABLE",
      "TARGET_AUTHORITY_EXCEEDS_ACTOR",
      "BRANCH_PERMISSION_DENIED",
      "ORG_HQ_TRANSFER_REQUIRED",
      "ORG_PARENT_INACTIVE",
      "INVALID_STATUS_TRANSITION",
      "ROLE_IS_SYSTEM",
      "ROLE_PRIVILEGE_ESCALATION",
      "ROLE_PERMISSION_GRANT_DENIED",
      "ROLE_PERMISSION_AUTHORITY_EXCEEDED",
      "TENANT_ROLE_PERMISSION_LIMIT_EXCEEDED",
      "TENANT_USER_CHANGED",
      "TENANT_USER_TEAM_QUERY_INVALID",
      "SCOPE_ROLE_ASSIGNMENT_CONFLICT",
      "TENANT_CONTEXT_MISSING",
    ] as const;

    for (const code of codes) {
      const enText = resolveCoreErrorText(
        apiError({ status: 409, code, correlationId: CORR_ID }),
        en,
      );
      const arText = resolveCoreErrorText(
        apiError({ status: 409, code, correlationId: CORR_ID }),
        ar,
      );
      expect(enText).toContain(en.coreIdentity.errors[code]);
      expect(enText).toContain(CORR_ID);
      expect(arText).toContain(ar.coreIdentity.errors[code]);
      expect(arText).toContain(CORR_ID);
    }
  });

  it("distinguishes client/gateway timeouts from offline network failures", () => {
    expect(
      resolveCoreErrorText(apiError({ status: 0, code: "CLIENT_REQUEST_TIMEOUT" }), en),
    ).toBe(en.coreIdentity.errors.REQUEST_TIMEOUT);
    expect(resolveCoreErrorText(apiError({ status: 504 }), ar)).toBe(
      ar.coreIdentity.errors.REQUEST_TIMEOUT,
    );
    expect(resolveCoreErrorText(apiError({ status: 0 }), en)).toBe(
      en.coreIdentity.errors.OFFLINE,
    );
    expect(resolveCoreErrorText(apiError({ status: 0 }), ar)).toBe(
      ar.coreIdentity.errors.OFFLINE,
    );
  });

  it("uses actionable HTTP status fallbacks and never leaks raw server message text", () => {
    const { result } = renderHook(() => useCoreErrorText());

    expect(result.current(apiError({ status: 403, code: "UNMAPPED_DENIAL" }))).toBe(
      en.coreIdentity.errors.FORBIDDEN,
    );
    expect(result.current(apiError({ status: 404, code: "UNMAPPED_MISSING" }))).toBe(
      en.coreIdentity.errors.NOT_FOUND,
    );
    expect(result.current(apiError({ status: 409, code: "UNMAPPED_CONFLICT" }))).toBe(
      en.coreIdentity.errors.CONFLICT,
    );
    expect(result.current(apiError({ status: 400 }))).toBe(
      en.coreIdentity.errors.VALIDATION_FAILED,
    );
    expect(result.current(apiError({ status: 422 }))).toBe(
      en.coreIdentity.errors.VALIDATION_FAILED,
    );
    const serverFailure = result.current(
      apiError({ status: 500, correlationId: CORR_ID }),
    );
    expect(serverFailure).toContain(en.coreIdentity.errors.UNKNOWN);
    expect(serverFailure).toContain(CORR_ID);
    expect(serverFailure).not.toContain("RAW_INTERNAL_SERVER_DIAGNOSTIC");
  });

  it("ignores Object.prototype keys so hostile or unexpected code strings fail safely", () => {
    for (const protoKey of ["toString", "constructor", "valueOf", "__proto__"]) {
      const text = resolveCoreErrorText(apiError({ status: 403, code: protoKey }), en);
      expect(text).toBe(en.coreIdentity.errors.FORBIDDEN);
      expect(text).not.toContain("function");
    }
  });
});
