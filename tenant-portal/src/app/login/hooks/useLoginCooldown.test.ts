// @vitest-environment jsdom

import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loginRetryAfterSeconds, useLoginCooldown } from "./useLoginCooldown";

function throttled(header?: string, detail: unknown = ["90"]) {
  return { response: { status: 429, headers: new Headers(header ? { "Retry-After": header } : {}),
    data: { errorCode: "AUTH_LOGIN_THROTTLED", details: { retryAfterSeconds: detail } } } };
}

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("login cooldown", () => {
  it("prefers Retry-After over the Core detail", () => {
    expect(loginRetryAfterSeconds(throttled("120"))).toBe(120);
  });
  it("accepts Retry-After HTTP dates", () => {
    const now = Date.parse("2026-10-17T10:00:00Z");
    expect(loginRetryAfterSeconds(throttled("Sat, 17 Oct 2026 10:02:00 GMT"), now)).toBe(120);
  });
  it.each([{ detail: ["90"] }, { detail: 90 }, { detail: "90" }])("accepts Core detail $detail", ({ detail }) => {
    expect(loginRetryAfterSeconds(throttled("invalid", detail))).toBe(90);
  });
  it("falls back safely when both timing values are malformed", () => {
    expect(loginRetryAfterSeconds(throttled("invalid", ["NaN"]))).toBe(60);
  });
  it("does not impose the Core login cooldown on unrelated errors", () => {
    expect(loginRetryAfterSeconds({ response: { status: 503 } })).toBeNull();
    expect(loginRetryAfterSeconds({ response: { status: 429, data: { code: "GW.RATE.LIMIT_EXCEEDED" } } })).toBeNull();
  });
  it("rounds minutes up, advances by elapsed wall time, and enables retry at expiry", () => {
    vi.useFakeTimers();
    vi.setSystemTime(1000000);
    const { result } = renderHook(() => useLoginCooldown());
    act(() => { result.current.startCooldown(throttled()); });
    expect(result.current.isCoolingDown).toBe(true);
    expect(result.current.retryMinutes).toBe(2);
    act(() => { vi.advanceTimersByTime(30000); });
    expect(result.current.retryMinutes).toBe(1);
    vi.setSystemTime(1091000);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.isCoolingDown).toBe(false);
  });
  it("cleans up the countdown on unmount", () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useLoginCooldown());
    act(() => { result.current.startCooldown(throttled()); });
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
