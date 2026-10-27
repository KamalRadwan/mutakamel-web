// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { axiosClient } from "../api/axiosClient";
import { confirmMfaSettings, readMfaFailure, readMfaSettings, readMfaStep, resendMfa, startMfaSettings } from "./mfaApi";

vi.mock("../api/axiosClient", () => ({
  axiosClient: { get: vi.fn(), post: vi.fn() },
  unwrapCoreData: (value: unknown) => (value as { data?: unknown })?.data ?? value,
  withAuthLock: (work: (signal?: AbortSignal) => Promise<unknown>) => work(),
}));

const step = { mfaRequired: true, challengeId: "a".repeat(43), expiresIn: 600, resendAfterSeconds: 60 };
const options = { skipAuthRefresh: true, skipAutoIdempotency: true, nonReplayable: true, cache: "no-store" };

beforeEach(() => vi.clearAllMocks());

describe("admin MFA contract", () => {
  it("projects a validated challenge without secrets and leaves normal sessions alone", () => {
    expect(readMfaStep({ data: { ...step, nonce: "must-not-escape" } })).toEqual(step);
    expect(readMfaStep({ data: { tokenType: "Bearer" } })).toBeNull();
  });

  it.each([
    { challengeId: "invalid" }, { mfaRequired: false }, { expiresIn: 601 },
    { expiresIn: "600" }, { resendAfterSeconds: -1 }, { expiresIn: 1.5 },
  ])("rejects malformed challenge fields %o", (override) => {
    expect(() => readMfaStep({ data: { ...step, ...override } })).toThrow("INVALID_MFA_RESPONSE");
  });

  it("validates enrollment instead of defaulting a missing flag to off", async () => {
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: { data: { mfaEnabled: true, mfaUpdatedAt: "2026-10-23T08:00:00.000Z" } } } as never);
    await expect(readMfaSettings()).resolves.toBe(true);
    vi.mocked(axiosClient.get).mockResolvedValueOnce({ data: { data: { mfaUpdatedAt: null } } } as never);
    await expect(readMfaSettings()).rejects.toThrow("INVALID_MFA_SETTINGS");
  });

  it.each([true, false])("starts the exact password-confirmed setting change (%s)", async (enabled) => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({ data: { data: step } } as never);
    await expect(startMfaSettings(enabled, "current-password")).resolves.toEqual(step);
    expect(axiosClient.post).toHaveBeenCalledWith("/api/admin/core/v1/auth/mfa/settings/challenge",
      { enabled, currentPassword: "current-password" }, expect.objectContaining(options));
  });

  it("keeps LOGIN and settings resend routes separate", async () => {
    vi.mocked(axiosClient.post).mockResolvedValue({ data: { data: step } } as never);
    await resendMfa(step.challengeId);
    await resendMfa(step.challengeId, true);
    expect(axiosClient.post).toHaveBeenNthCalledWith(1, "/api/admin/core/v1/auth/mfa/resend",
      { challengeId: step.challengeId }, expect.objectContaining(options));
    expect(axiosClient.post).toHaveBeenNthCalledWith(2, "/api/admin/core/v1/auth/mfa/settings/resend",
      { challengeId: step.challengeId }, expect.objectContaining(options));
  });

  it("sends a leading-zero code once and accepts only a 204 confirmation", async () => {
    vi.mocked(axiosClient.post).mockResolvedValueOnce({ status: 204 } as never);
    await confirmMfaSettings(step.challengeId, "012345");
    expect(axiosClient.post).toHaveBeenCalledTimes(1);
    expect(axiosClient.post).toHaveBeenCalledWith("/api/admin/core/v1/auth/mfa/settings/confirm",
      { challengeId: step.challengeId, code: "012345" }, expect.objectContaining(options));
    vi.mocked(axiosClient.post).mockResolvedValueOnce({ status: 200 } as never);
    await expect(confirmMfaSettings(step.challengeId, "012345")).rejects.toThrow("INVALID_MFA_RESPONSE");
  });

  it("preserves header/body retry delays and treats unknown failures as ambiguous", () => {
    expect(readMfaFailure({ response: { status: 429, headers: new Headers({ "Retry-After": "91" }) } }))
      .toEqual({ kind: "throttled", retrySeconds: 91 });
    expect(readMfaFailure({ response: { status: 429, data: { details: { retryAfterSeconds: ["120"] } } } }))
      .toEqual({ kind: "throttled", retrySeconds: 120 });
    expect(readMfaFailure(new TypeError("offline")).kind).toBe("ambiguous");
    expect(readMfaFailure({ response: { status: 401, data: { errorCode: "AUTH_MFA_INVALID_CHALLENGE" } } }).kind).toBe("invalid");
  });
});
