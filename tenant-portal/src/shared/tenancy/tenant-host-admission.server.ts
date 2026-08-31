import { isIP } from "node:net";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

export type TenantHostStatus = "ACTIVE" | "SUSPENDED";

const HOST_STATUS_PATH = "/api/tenant/core/v1/public/tenant-host/status";
const HOST_STATUS_TIMEOUT_MS = 2_000;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u;

export function normalizeTenantRequestHost(rawHost: string | null): string | null {
  const authority = rawHost?.trim().toLowerCase();
  if (!authority || authority.includes(",") || authority.startsWith("[")) return null;

  const separator = authority.lastIndexOf(":");
  let hostname = authority;
  if (separator !== -1) {
    if (authority.indexOf(":") !== separator) return null;

    const port = authority.slice(separator + 1);
    const portNumber = Number(port);
    if (!/^\d{1,5}$/u.test(port) || portNumber < 1 || portNumber > 65_535) return null;
    hostname = authority.slice(0, separator);
  }

  hostname = hostname.replace(/\.$/u, "");
  if (!hostname || hostname.length > 253 || isIP(hostname) !== 0) return null;

  return hostname.split(".").every((label) => DNS_LABEL.test(label))
    ? hostname
    : null;
}

/**
 * Sends the host-status probe with the tenant's Host header actually on the
 * wire.
 *
 * `fetch` cannot do this. `host` is a forbidden header name in the fetch
 * standard, so undici drops it silently — the Gateway then sees the internal
 * origin's own authority and answers TENANT_HOST_NOT_FOUND, which fails
 * admission closed and 404s every page. That was invisible for two reasons:
 * the unit test asserts the header on the init object it passed to a *mock*
 * fetch, which records what the caller intended rather than what the network
 * carried; and `x-forwarded-host` is not a substitute, because the Gateway
 * only trusts it when its own trust-proxy depth is configured, which it is
 * not here.
 *
 * Shaped like `fetch` so the existing injectable seam and its tests are
 * unchanged.
 */
function sendHostStatusProbe(url: URL, init: RequestInit): Promise<Response> {
  const send = url.protocol === "https:" ? httpsRequest : httpRequest;
  const headers = new Headers(init.headers);
  const hostHeader = headers.get("host");

  return new Promise((resolve, reject) => {
    const clientRequest = send(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        // Node lets us set Host here; the fetch standard does not.
        headers: { accept: "application/json", ...(hostHeader ? { Host: hostHeader } : {}) },
        timeout: HOST_STATUS_TIMEOUT_MS,
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          resolve(
            new Response(Buffer.concat(chunks), {
              status: response.statusCode ?? 502,
            }),
          );
        });
      },
    );

    clientRequest.on("timeout", () => clientRequest.destroy(new Error("Host status probe timed out")));
    clientRequest.on("error", reject);
    clientRequest.end();
  });
}

export async function fetchTenantHostStatus(
  host: string,
  gatewayOrigin: string | undefined,
  fetcher: typeof fetch = sendHostStatusProbe as unknown as typeof fetch,
): Promise<TenantHostStatus | null> {
  const endpoint = hostStatusEndpoint(gatewayOrigin);
  if (!endpoint) return null;

  try {
    const response = await fetcher(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        host,
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(HOST_STATUS_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const payload: unknown = await response.json();
    if (!isRecord(payload) || payload.success !== true || !isRecord(payload.data)) {
      return null;
    }

    const status = payload.data.status;
    return status === "ACTIVE" || status === "SUSPENDED" ? status : null;
  } catch {
    return null;
  }
}

function hostStatusEndpoint(gatewayOrigin: string | undefined): URL | null {
  if (!gatewayOrigin) return null;

  try {
    const origin = new URL(gatewayOrigin);
    if (
      (origin.protocol !== "http:" && origin.protocol !== "https:")
      || origin.username
      || origin.password
      || (origin.pathname !== "/" && origin.pathname !== "")
      || origin.search
      || origin.hash
    ) {
      return null;
    }

    return new URL(HOST_STATUS_PATH, origin);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
