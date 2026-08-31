import { TenantPortalRuntime } from "@/components/auth/TenantPortalRuntime";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <TenantPortalRuntime>{children}</TenantPortalRuntime>;
}
