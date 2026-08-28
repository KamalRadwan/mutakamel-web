import { TenantPortalRuntime } from "@/components/auth/TenantPortalRuntime";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  return <TenantPortalRuntime>{children}</TenantPortalRuntime>;
}
