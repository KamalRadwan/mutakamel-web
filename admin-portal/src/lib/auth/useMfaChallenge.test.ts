// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import type { FormEvent } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resendMfa } from "./mfaApi";
import { useMfaChallenge } from "./useMfaChallenge";

vi.mock("./mfaApi", async (original) => ({
  ...await original<typeof import("./mfaApi")>(),
  resendMfa: vi.fn(),
}));

const step = { mfaRequired: true as const, challengeId: "a".repeat(43), expiresIn: 600, resendAfterSeconds: 60 };
const event = () => ({ preventDefault: vi.fn() }) as unknown as FormEvent;
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-23T08:00:00Z")); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("admin MFA challenge interaction", () => {
  it("keeps leading zeroes and clears the code after an invalid attempt", async () => {
    const verify = vi.fn().mockRejectedValue({ response: { status: 401, data: { errorCode: "AUTH_MFA_INVALID_CHALLENGE" } } });
    const { result } = renderHook(() => useMfaChallenge(verify));
    act(() => result.current.start(step));
    act(() => result.current.setCode("012345"));
    await act(async () => result.current.submit(event()));
    expect(verify).toHaveBeenCalledWith(step.challengeId, "012345");
    expect(result.current.code).toBe("");
    expect(result.current.error).toBe("invalid");
  });

  it("never sends a resend before its cooldown or extends the original deadline", async () => {
    const { result } = renderHook(() => useMfaChallenge(vi.fn(), true));
    act(() => result.current.start(step));
    await act(async () => result.current.resend());
    expect(resendMfa).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(60_000));
    vi.mocked(resendMfa).mockResolvedValue({ ...step, expiresIn: 600 });
    await act(async () => result.current.resend());
    expect(resendMfa).toHaveBeenCalledWith(step.challengeId, true);
    act(() => vi.advanceTimersByTime(540_000));
    expect(result.current.expired).toBe(true);
    await act(async () => result.current.resend());
    expect(resendMfa).toHaveBeenCalledTimes(1);
  });

  it("enforces Retry-After across verification and resend without resetting it on restart", async () => {
    const verify = vi.fn().mockRejectedValue({ response: { status: 429, headers: new Headers({ "Retry-After": "90" }) } });
    const { result } = renderHook(() => useMfaChallenge(verify));
    act(() => result.current.start(step));
    act(() => result.current.setCode("012345"));
    await act(async () => result.current.submit(event()));
    act(() => result.current.reset());
    act(() => result.current.start(step));
    act(() => result.current.setCode("012345"));
    await act(async () => result.current.submit(event()));
    await act(async () => result.current.resend());
    expect(verify).toHaveBeenCalledTimes(1);
    expect(resendMfa).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(90_000));
    expect(result.current.blocked).toBe(false);
  });

  it("requires a restart after an ambiguous verification and never retries automatically", async () => {
    const verify = vi.fn().mockRejectedValue(new TypeError("network lost after send"));
    const { result } = renderHook(() => useMfaChallenge(verify));
    act(() => result.current.start(step));
    act(() => result.current.setCode("012345"));
    await act(async () => result.current.submit(event()));
    act(() => result.current.setCode("012345"));
    await act(async () => result.current.submit(event()));
    act(() => vi.advanceTimersByTime(120_000));
    expect(verify).toHaveBeenCalledTimes(1);
    expect(result.current.restartRequired).toBe(true);
    expect(result.current.error).toBe("ambiguous");
  });
});
