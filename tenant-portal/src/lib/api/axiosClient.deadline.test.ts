// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient } from "./axiosClient";
import { normalizeApiError } from "./errors";
import { isAmbiguousWriteFailure, runIdempotentWrite } from "./idempotent-write";

const PATH = "/api/tenant/core/v1/settings/workspace";
const KEY = "01900000-0000-7000-8000-000000000001";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ordinary request deadline", () => {
  it.each(["ar", "en"] as const)("bounds stalled headers and translates recovery in %s", async (lang) => {
    window.localStorage.setItem("tenant_lang", lang);
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const pending = axiosClient.get(PATH, { timeoutMs: 25 }).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(25);
    const error = await pending;
    expect(normalizeApiError(error)).toMatchObject({
      status: 504,
      code: "CLIENT_REQUEST_TIMEOUT",
      message: (lang === "en" ? en : ar).errors.requestTimedOut,
    });
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("bounds stalled body consumption and retains an auto-generated write key", async () => {
    window.localStorage.setItem("tenant_lang", "en");
    const response = new Response("{}");
    vi.spyOn(response, "text").mockImplementation(() => new Promise<string>(() => {}));
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => response);
    vi.stubGlobal("fetch", fetchMock);
    const pending = axiosClient.put(PATH, { timezone: "UTC" }, { timeoutMs: 40 })
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(40);
    const error = await pending;
    const key = new Headers(fetchMock.mock.calls[0][1]?.headers).get("x-idempotency-key");
    expect(key).toBeTruthy();
    expect(normalizeApiError(error)).toMatchObject({
      code: "CLIENT_REQUEST_TIMEOUT",
      message: en.errors.writeTimedOut,
      idempotencyKey: key,
    });
    expect(isAmbiguousWriteFailure(error)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retains the write attempt for an explicit same-key recovery", async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) => new Promise<Response>(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    const options = {
      attempt: { idempotencyKey: KEY },
      method: "put" as const,
      path: PATH,
      body: { timezone: "UTC" },
      parse: (value: unknown) => value,
      config: { timeoutMs: 25 },
    };
    const first = runIdempotentWrite(options);
    await vi.advanceTimersByTimeAsync(25);
    expect(await first).toMatchObject({ kind: "ambiguous", error: { idempotencyKey: KEY } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockImplementation(async () => new Response("{}"));
    expect(await runIdempotentWrite(options)).toMatchObject({ kind: "success" });
    for (const [, init] of fetchMock.mock.calls) {
      expect(new Headers(init?.headers).get("x-idempotency-key")).toBe(KEY);
    }
  });

  it("preserves caller cancellation during a stalled body and removes its listener", async () => {
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const response = new Response("{}");
    vi.spyOn(response, "text").mockImplementation(() => new Promise<string>(() => {}));
    vi.stubGlobal("fetch", vi.fn(async () => response));
    const pending = axiosClient.get(PATH, { signal: controller.signal, timeoutMs: 50 })
      .catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1);
    controller.abort();
    expect(await pending).toMatchObject({ name: "AbortError" });
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not send an already cancelled request", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(axiosClient.get(PATH, { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("defaults to 30 seconds and clears the timer after a successful request", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
    const pending = axiosClient.get(PATH).catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(normalizeApiError(await pending).code).toBe("CLIENT_REQUEST_TIMEOUT");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")));
    await axiosClient.get(PATH);
    expect(vi.getTimerCount()).toBe(0);
  });
});
