import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  isSupportedCorePath,
  isSupportedCrmPath,
  isSupportedTradePath,
} from "./lib/navigation/tenant-routes";

type TenantModule = "core" | "crm" | "trade";

const SUPPORTED_PATH_CHECKS: Record<TenantModule, (pathname: string) => boolean> = {
  core: isSupportedCorePath,
  crm: isSupportedCrmPath,
  trade: isSupportedTradePath,
};

export function proxy(request: NextRequest): NextResponse {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new NextResponse(null, {
      status: 405,
      headers: {
        Allow: "GET, HEAD",
        "Cache-Control": "no-store",
      },
    });
  }

  const pathname = request.nextUrl.pathname;
  const tenantModule = pathname.split("/")[1] as TenantModule;

  if (SUPPORTED_PATH_CHECKS[tenantModule](pathname)) {
    return NextResponse.next();
  }

  const unavailableUrl = request.nextUrl.clone();
  unavailableUrl.pathname = "/unavailable";
  unavailableUrl.search = "";
  unavailableUrl.searchParams.set("module", tenantModule);

  return NextResponse.redirect(unavailableUrl);
}

export const config = {
  matcher: ["/core/:path*", "/crm/:path*", "/trade/:path*"],
};
