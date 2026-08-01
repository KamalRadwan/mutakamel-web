import { afterEach, describe, expect, it, vi } from "vitest";
import { customFetch } from "./axiosClient";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("admin cookie refresh retry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("retries with the rotated cookie and never reattaches a legacy bearer token", async () => {
    const storage = new MemoryStorage();
    storage.setItem("access_token", "expired-access-token");
    storage.setItem(
      "admin_session_meta",
      JSON.stringify({
        accessToken: "expired-access-token",
        savedAt: 0,
        expiresIn: 3600,
        tokenType: "Bearer",
        loginGeneration: "test-generation",
        remember: false,
        cookieRevision: 1,
      }),
    );

    vi.stubGlobal("window", {
      location: { pathname: "/users", href: "" },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(1),
    });

    const requests: Array<{ url: string; headers: Headers }> = [];
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async (url: string, init: RequestInit) => {
        requests.push({ url, headers: new Headers(init.headers) });
        return new Response("", { status: 401 });
      })
      .mockImplementationOnce(async (url: string, init: RequestInit) => {
        requests.push({ url, headers: new Headers(init.headers) });
        return new Response(
          JSON.stringify({
            data: {
              tokenType: "Bearer",
              expiresIn: 3600,
              refreshExpiresIn: 2_592_000,
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      })
      .mockImplementationOnce(async (url: string, init: RequestInit) => {
        requests.push({ url, headers: new Headers(init.headers) });
        return new Response(JSON.stringify({ data: [{ id: "admin-1" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await customFetch<{ data: Array<{ id: string }> }>(
      "/api/admin/core/v1/users",
    );

    expect(result.status).toBe(200);
    expect(requests).toHaveLength(3);
    expect(requests[1].url).toBe("/api/admin/core/v1/auth/refresh");
    for (const request of requests) {
      expect(request.headers.get("x-auth-cookie-mode")).toBe("1");
      expect(request.headers.has("Authorization")).toBe(false);
    }
    expect(storage.getItem("access_token")).toBeNull();
    expect(storage.getItem("admin_session_meta")).not.toContain("accessToken");
  });
});
