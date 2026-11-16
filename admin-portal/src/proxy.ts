import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function createNonce(): string {
  // A nonce is not an identifier: all 128 bits must be unpredictable.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function buildContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    // React/Radix emit style attributes, which cannot be allowed by a nonce.
    "style-src 'self' 'unsafe-inline'",
    // LocationPickerDialog loads tiles from this exact origin.
    "img-src 'self' data: blob: https://tile.openstreetmap.org",
    "font-src 'self'",
    // WebPhone WSS hosts come from runtime admin settings, so there is no
    // static host list. Allow secure WebSockets, not arbitrary HTTPS fetches.
    // STUN/TURN ICE traffic is not governed by connect-src and needs no entry.
    // The development-only ws: allowance supports Next's local HMR socket.
    `connect-src 'self' wss:${isDevelopment ? " ws:" : ""}`,
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function proxy(request: NextRequest): NextResponse {
  const nonce = createNonce();
  const policy = buildContentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  // Next extracts the nonce from the REQUEST CSP for its framework scripts.
  // Replace caller-supplied values so the renderer and browser share our nonce.
  requestHeaders.set("Content-Security-Policy", policy);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(self), geolocation=()",
  );
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
