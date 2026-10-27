// @vitest-environment node
import { createServer, type IncomingMessage, type ServerResponse, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POST, GET, HEAD } from "../../app/api/[...path]/route";

let server: Server | undefined;

async function gateway(handler: (request: IncomingMessage, response: ServerResponse) => void) {
  server = createServer(handler);
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("DEV_API_TARGET", `http://127.0.0.1:${(server.address() as AddressInfo).port}`);
}

afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    server = undefined;
  }
});

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://mersany.mutakamel.ai:5002${path}`, {
    ...init,
    headers: { host: "mersany.mutakamel.ai:5002", ...init.headers },
  });
}

describe("development Gateway proxy over a real HTTP connection", () => {
  it("forwards tenant WebPhone paths and query strings to the Gateway", async () => {
    let received: { url?: string; host?: string } | undefined;
    await gateway((req, res) => {
      received = { url: req.url, host: req.headers.host };
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"enabled":true}');
    });
    const path = "/api/tenant/webphone/v1/config?name=a%2Fb";
    const result = await GET(request(path));
    expect(result.status).toBe(200);
    expect(await result.text()).toBe('{"enabled":true}');
    expect(received).toEqual({ url: path, host: "mersany.mutakamel.ai:5002" });
  });

  it("preserves tenant authority, auth body and each response cookie without trusting forwarded headers", async () => {
    let received: { headers: IncomingMessage['headers']; method?: string; url?: string; body: string } | undefined;
    const cookies = [
      "access=fixture; Path=/; HttpOnly; SameSite=Lax",
      "refresh=fixture; Path=/; HttpOnly; Expires=Thu, 01 Jan 2037 00:00:00 GMT",
      "csrf=fixture; Path=/; SameSite=Lax",
    ];
    await gateway((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        received = { headers: req.headers, method: req.method, url: req.url, body: Buffer.concat(chunks).toString() };
        res.writeHead(200, { "set-cookie": cookies, "content-type": "application/json", "cache-control": "private, no-store",
          connection: "x-internal-hop", "x-internal-hop": "private" });
        res.end('{"fixture":"upstream"}');
      });
    });
    const body = JSON.stringify({ token: "fixture-invite", newPassword: "fixture-password" });
    const result = await POST(request("/api/tenant/core/v1/auth/accept-invite", {
      method: "POST", body,
      headers: { "content-type": "application/json", origin: "http://mersany.mutakamel.ai:5002",
        cookie: "csrf=fixture", "x-csrf-token": "fixture", "x-forwarded-host": "attacker.invalid",
        "x-forwarded-for": "192.0.2.10", forwarded: "host=attacker.invalid", "x-real-ip": "192.0.2.11" },
    }));
    expect(result.status).toBe(200);
    expect(await result.text()).toBe('{"fixture":"upstream"}');
    expect(result.headers.getSetCookie()).toEqual(cookies);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(result.headers.has("x-internal-hop")).toBe(false);
    expect(received).toMatchObject({ method: "POST", url: "/api/tenant/core/v1/auth/accept-invite", body,
      headers: { host: "mersany.mutakamel.ai:5002", origin: "http://mersany.mutakamel.ai:5002",
        cookie: "csrf=fixture", "x-csrf-token": "fixture", "content-type": "application/json" } });
    for (const name of ["forwarded", "x-forwarded-host", "x-forwarded-for", "x-real-ip"]) {
      expect(received!.headers[name]).toBeUndefined();
    }
  });

  it("preserves encoded query strings, binary bodies and upstream failures", async () => {
    let actualPath: string | undefined;
    const binary = Buffer.from([0, 255, 13, 10, 128]);
    await gateway((req, res) => {
      actualPath = req.url;
      res.writeHead(404, { "content-type": "application/octet-stream", "content-length": binary.length });
      res.end(binary);
    });
    const path = "/api/tenant/core/v1/branding/public/logo?name=a%2Fb&name=c%20d";
    const result = await GET(request(path));
    expect(result.status).toBe(404);
    expect(Buffer.from(await result.arrayBuffer())).toEqual(binary);
    expect(actualPath).toBe(path);
  });

  it.each([204, 304])("handles bodyless status %s", async status => {
    await gateway((_req, res) => { res.writeHead(status); res.end(); });
    const result = await HEAD(request("/api/tenant/core/v1/branding/public", { method: "HEAD" }));
    expect(result.status).toBe(status);
    expect(await result.text()).toBe("");
  });

  it("passes a redirect back without following it server-side", async () => {
    let requests = 0;
    await gateway((_req, res) => { requests++; res.writeHead(302, { location: "http://other.invalid/" }); res.end(); });
    const result = await GET(request("/api/tenant/core/v1/branding/public"));
    expect(result.status).toBe(302);
    expect(result.headers.get("location")).toBe("http://other.invalid/");
    await result.body?.cancel();
    expect(requests).toBe(1);
  });

  it.each([
    { mode: "production", path: "/api/tenant/core/v1/branding/public", status: 404 },
    { mode: "production", path: "/api/tenant/webphone/v1/config", status: 404 },
    { mode: "development", path: "/api/admin/webphone/v1/config", status: 404 },
    { mode: "development", path: "/api/tenant/webphone/v2/config", status: 404 },
    { mode: "development", path: "/api/tenant/webphone-other/v1/config", status: 404 },
    { mode: "development", path: "/api/admin/core/v1/auth/login", status: 404 },
    { mode: "development", path: "/api/tenant/core/v2/auth/login", status: 404 },
    { mode: "development", path: "/api/tenant/core/v1/auth/login", host: "tenant.invalid,attacker.invalid", status: 400 },
  ])("does not forward disallowed ingress: $mode $path $host", async input => {
    let calls = 0;
    await gateway((_req, res) => { calls++; res.end(); });
    vi.stubEnv("NODE_ENV", input.mode);
    const result = await GET(request(input.path, input.host ? { headers: { host: input.host } } : {}));
    expect(result.status).toBe(input.status);
    expect(calls).toBe(0);
  });

  it("bounds a broken upstream response without exposing internal errors", async () => {
    await gateway((req) => req.socket.destroy());
    const result = await GET(request("/api/tenant/core/v1/branding/public"));
    expect(result.status).toBe(502);
    expect(await result.text()).toBe("");
    expect(result.headers.get("cache-control")).toBe("no-store");
  });
});
