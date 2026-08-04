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

  it("does not attach an idempotency key when the route contract opts out", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", {
      location: { pathname: "/backup", href: "" },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(1),
    });

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(new Headers(init.headers).has("x-idempotency-key")).toBe(false);
      return new Response(JSON.stringify({ data: { id: "run-1" } }), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await customFetch("/api/admin/worker/v1/backups/runs", {
      method: "POST",
      body: JSON.stringify({ databaseServerId: "server-1" }),
      skipAutoIdempotency: true,
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not refresh or replay a non-replayable POST after a 401", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", {
      location: { pathname: "/backup", href: "" },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("sessionStorage", storage);

    const requestOptions: RequestInit[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      requestOptions.push(init);
      return new Response(
        JSON.stringify({
          type: "https://errors.mutakamel.ai/authentication-required",
          title: "Authentication required",
          status: 401,
          code: "AUTH.SESSION.REQUIRED",
          correlationId: "019f-non-replayable",
        }),
        {
          status: 401,
          headers: { "Content-Type": "application/problem+json" },
        },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      customFetch("/api/admin/worker/v1/backups/runs", {
        method: "POST",
        body: JSON.stringify({ databaseServerId: "server-1" }),
        nonReplayable: true,
        skipAutoIdempotency: true,
      }),
    ).rejects.toMatchObject({
      response: {
        status: 401,
        data: {
          errorCode: "AUTH.SESSION.REQUIRED",
          correlationId: "019f-non-replayable",
        },
      },
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "/api/admin/worker/v1/backups/runs",
    );
    expect(requestOptions[0]).not.toHaveProperty("nonReplayable");
    expect(requestOptions[0]).not.toHaveProperty("skipAutoIdempotency");
    expect(new Headers(requestOptions[0]?.headers).has("x-idempotency-key")).toBe(
      false,
    );
  });

  it("keeps automatic idempotency for ordinary mutations", async () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("window", {
      location: { pathname: "/database-servers", href: "" },
      dispatchEvent: vi.fn(),
    });
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("sessionStorage", storage);
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => bytes.fill(1),
    });

    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      expect(new Headers(init.headers).get("x-idempotency-key")).toMatch(
        /^[0-9a-f-]{36}$/,
      );
      return new Response(JSON.stringify({ data: { id: "server-1" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await customFetch("/api/admin/core/v1/database-servers/server-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Primary" }),
    });

    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
