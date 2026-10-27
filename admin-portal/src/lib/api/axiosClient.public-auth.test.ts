// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ar } from "@/i18n/dictionaries/ar";
import { en } from "@/i18n/dictionaries/en";
import { axiosClient } from "./axiosClient";

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe.each(["ar", "en"])("public auth 503 in %s", (language) => {
  it.each(["login", "forgot-password", "reset-password", "accept-invite"])("localizes %s without losing error evidence or replaying", async (route) => {
    window.localStorage.setItem("app_lang", language);
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      errorCode: "GW.RATE.UNAVAILABLE", message: "raw upstream text", correlationId: "reference-1",
      details: { reason: ["unavailable"] },
    }), { status: 503, headers: { "Retry-After": "30" } }));
    vi.stubGlobal("fetch", fetchMock);
    const copy = language === "en" ? en : ar;
    await expect(axiosClient.post(`/api/admin/core/v1/auth/${route}`, {}, {
      skipAuthRefresh: true, skipAutoIdempotency: true, nonReplayable: true,
    })).rejects.toMatchObject({ response: {
      status: 503,
      data: { message: copy.login.temporarilyUnavailable, errorCode: "GW.RATE.UNAVAILABLE",
        correlationId: "reference-1", details: { reason: ["unavailable"] } },
    } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
