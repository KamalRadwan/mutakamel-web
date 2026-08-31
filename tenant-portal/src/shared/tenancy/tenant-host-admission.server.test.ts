import { createServer, type Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  fetchTenantHostStatus,
  normalizeTenantRequestHost,
} from "./tenant-host-admission.server";

describe("tenant host admission", () => {
  it("normalizes one DNS host and a valid port", () => {
    expect(normalizeTenantRequestHost(" ERP.Example.COM:443 ")).toBe("erp.example.com");
    expect(normalizeTenantRequestHost("erp.example.com.")).toBe("erp.example.com");
  });

  it.each([
    null,
    "",
    "erp.example.com,attacker.invalid",
    "https://erp.example.com",
    "127.0.0.1",
    "[::1]",
    "erp_example.com",
    "erp.example.com:0",
    "erp.example.com:65536",
  ])("rejects a malformed or non-DNS authority: %s", (host) => {
    expect(normalizeTenantRequestHost(host)).toBeNull();
  });

  it("calls only the configured Gateway while preserving the normalized Host", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: { status: "SUSPENDED" },
    }), { status: 200 }));
    const fetcher = fetchMock as unknown as typeof fetch;

    await expect(fetchTenantHostStatus(
      "erp.example.com",
      "http://gateway.internal:9000",
      fetcher,
    )).resolves.toBe("SUSPENDED");

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe(
      "http://gateway.internal:9000/api/tenant/core/v1/public/tenant-host/status",
    );
    expect(init).toMatchObject({ cache: "no-store", redirect: "error" });
    expect(new Headers(init.headers).get("host")).toBe("erp.example.com");
    expect(new Headers(init.headers).get("x-forwarded-host")).toBeNull();
  });

  // The mock-fetch test above asserts the header on the init object the caller
  // built, which is what the caller *intended* to send. It passed for months
  // while the real transport dropped the header, because `host` is a forbidden
  // header name in the fetch standard. This one asserts what actually arrived
  // over a socket, which is the only thing the Gateway ever sees.
  describe("the Host header on the wire", () => {
    let server: Server;
    let origin: string;
    let received: string | undefined;

    beforeAll(async () => {
      server = createServer((request, response) => {
        received = request.headers.host;
        response.writeHead(200, { "content-type": "application/json" });
        response.end(JSON.stringify({ success: true, data: { status: "ACTIVE" } }));
      });
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      origin = `http://127.0.0.1:${port}`;
    });

    afterAll(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    it("carries the tenant Host to the Gateway, not the internal origin's own", async () => {
      await expect(fetchTenantHostStatus("erp.example.com", origin))
        .resolves.toBe("ACTIVE");
      expect(received).toBe("erp.example.com");
      expect(received).not.toContain("127.0.0.1");
    });
  });

  it.each([
    undefined,
    "file:///tmp/gateway",
    "http://user:secret@gateway.internal",
    "http://gateway.internal/base-path",
  ])("fails closed for an unsafe internal Gateway origin: %s", async (origin) => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(fetchTenantHostStatus("erp.example.com", origin, fetcher))
      .resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("fails closed for upstream errors and malformed success envelopes", async () => {
    const unavailable = vi.fn(
      async () => new Response(null, { status: 503 }),
    ) as unknown as typeof fetch;
    const malformed = vi.fn(async () => new Response(JSON.stringify({
      success: true,
      data: { status: "PROVISIONING" },
    }), { status: 200 })) as unknown as typeof fetch;

    await expect(fetchTenantHostStatus(
      "erp.example.com",
      "http://gateway.internal:9000",
      unavailable,
    )).resolves.toBeNull();
    await expect(fetchTenantHostStatus(
      "erp.example.com",
      "http://gateway.internal:9000",
      malformed,
    )).resolves.toBeNull();
  });
});
