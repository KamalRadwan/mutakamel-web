import { headers } from "next/headers";
import { notFound } from "next/navigation";
import {
  fetchTenantHostStatus,
  resolveTenantAdmissionHost,
} from "@/shared/tenancy/tenant-host-admission.server";
import { TenantHostStateBoundary } from "./TenantHostStateBoundary";

export async function TenantHostAdmission({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const host = resolveTenantAdmissionHost(requestHeaders.get("host"));
  if (!host) notFound();

  const gatewayOrigin = process.env.TENANT_GATEWAY_INTERNAL_ORIGIN
    ?? (process.env.NODE_ENV === "development" ? process.env.DEV_API_TARGET : undefined);
  const status = await fetchTenantHostStatus(host, gatewayOrigin);
  if (!status) notFound();

  return (
    <TenantHostStateBoundary status={status}>
      {children}
    </TenantHostStateBoundary>
  );
}
