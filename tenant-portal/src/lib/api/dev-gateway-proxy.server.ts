import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { Readable } from "node:stream";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";

const HOP_HEADERS = [
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade",
];

function endToEndHeaders(input: Headers): Headers {
  const output = new Headers(input);
  for (const name of [...HOP_HEADERS, ...(input.get("connection") ?? "").split(",")]) {
    if (name.trim()) output.delete(name.trim());
  }
  return output;
}

function gatewayOrigin(): URL {
  const target = new URL(process.env.DEV_API_TARGET || "http://localhost:9000");
  if (!["http:", "https:"].includes(target.protocol) || target.username || target.password
    || target.pathname !== "/" || target.search || target.hash) {
    throw new Error("DEV_API_TARGET must be a Gateway origin");
  }
  return target;
}

function unavailable(status: number): Response {
  return new Response(null, { status, headers: { "Cache-Control": "no-store" } });
}

/** Next's external rewrites use changeOrigin=true. Gateway deliberately derives
 * tenant authority from Host, not caller X-Forwarded-Host, so use Node's HTTP
 * transport to retain the browser authority while connecting to a fixed origin.
 * Production /api ingress remains owned by the external reverse proxy. */
export async function proxyDevelopmentGateway(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== "development") return unavailable(404);
  const url = new URL(request.url);
  if (!/^\/api\/tenant\/(core|crm|trade|webphone)\/v1\//u.test(url.pathname)) return unavailable(404);
  const host = request.headers.get("host");
  if (!host || /[\s,/@\\?#]/u.test(host)) return unavailable(400);

  try {
    const target = gatewayOrigin();
    const headers = endToEndHeaders(request.headers);
    for (const name of [...headers.keys()]) {
      if (name === "forwarded" || name.startsWith("x-forwarded-") || name === "x-real-ip") headers.delete(name);
    }
    headers.delete("expect");
    headers.set("host", host);
    const send = target.protocol === "https:" ? httpsRequest : httpRequest;

    return await new Promise<Response>((resolve, reject) => {
      const upstream = send(target, {
        method: request.method,
        path: `${url.pathname}${url.search}`,
        headers: Object.fromEntries(headers),
        timeout: 30_000,
      }, (incoming) => {
        const received = new Headers();
        for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
          received.append(incoming.rawHeaders[index]!, incoming.rawHeaders[index + 1]!);
        }
        const status = incoming.statusCode ?? 502;
        const empty = request.method === "HEAD" || [204, 205, 304].includes(status);
        if (empty) incoming.resume();
        resolve(new Response(empty ? null : Readable.toWeb(incoming) as ReadableStream<Uint8Array>, {
          status,
          headers: endToEndHeaders(received),
        }));
      });
      const abort = () => upstream.destroy(new Error("Gateway request aborted"));
      upstream.on("error", reject);
      upstream.once("timeout", () => upstream.destroy(new Error("Gateway request timed out")));
      request.signal.addEventListener("abort", abort, { once: true });
      upstream.once("close", () => request.signal.removeEventListener("abort", abort));
      if (request.signal.aborted) { abort(); return; }
      if (request.body) {
        const body = Readable.fromWeb(request.body as NodeReadableStream<Uint8Array>);
        body.on("error", (error) => upstream.destroy(error));
        upstream.once("close", () => body.destroy());
        body.pipe(upstream);
      } else upstream.end();
    });
  } catch {
    return unavailable(502);
  }
}
