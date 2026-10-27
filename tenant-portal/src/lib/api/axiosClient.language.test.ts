// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setLanguage } from "@/i18n/useLanguage";
import { axiosClient, refreshTenantCookieSession } from "./axiosClient";

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
  vi.spyOn(window.navigator, "language", "get").mockReturnValue("en-US");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("API request language", () => {
  it("uses the Arabic default and follows language switches for server errors", async () => {
    const messages: Record<string, string> = {
      ar: "رسالة التحقق من الخادم",
      en: "Server validation message",
    };
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const language = new Headers(init?.headers).get("Accept-Language");
      return new Response(JSON.stringify({
        message: messages[language ?? ""],
      }), { status: 422 });
    });
    vi.stubGlobal("fetch", fetchMock);

    for (const language of ["ar", "en", "ar"] as const) {
      if (fetchMock.mock.calls.length > 0) setLanguage(language);
      await expect(axiosClient.get("/api/tenant/core/v1/auth/me"))
        .rejects.toMatchObject({
          message: messages[language],
          response: { data: { message: messages[language] } },
        });
      const init = fetchMock.mock.calls.at(-1)?.[1];
      expect(new Headers(init?.headers).get("Accept-Language")).toBe(language);
    }
  });

  it.each([
    { headers: { "aCcEpT-LaNgUaGe": "en-GB,en;q=0.8" } },
    { headers: new Headers({ "accept-language": "en-GB,en;q=0.8" }) },
    { headers: [["accept-language", "en-GB,en;q=0.8"]] as [string, string][] },
  ])("preserves caller overrides for every HeadersInit form: %j", async ({ headers }) => {
    setLanguage("ar");
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await axiosClient.get("/api/tenant/core/v1/auth/me", { headers });

    expect(new Headers(fetchMock.mock.calls[0][1]?.headers)
      .get("Accept-Language")).toBe("en-GB,en;q=0.8");
    expect(new Headers(headers).get("Accept-Language")).toBe("en-GB,en;q=0.8");
  });

  it("applies the current selection to each direct auth refresh", async () => {
    vi.spyOn(document, "cookie", "get").mockReturnValue(
      "mutakamel-http-tenant-csrf=csrf-proof",
    );
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify({ message: "Rejected refresh" }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);

    for (const language of ["ar", "en"] as const) {
      setLanguage(language);
      await expect(refreshTenantCookieSession()).rejects.toMatchObject({
        response: { status: 400 },
      });
      const [url, init] = fetchMock.mock.calls.at(-1)!;
      const headers = new Headers(init?.headers);
      expect(url).toBe("/api/tenant/core/v1/auth/refresh");
      expect(headers.get("Accept-Language")).toBe(language);
      expect(headers.get("x-csrf-token")).toBe("csrf-proof");
      expect(init?.credentials).toBe("include");
    }
  });
});
