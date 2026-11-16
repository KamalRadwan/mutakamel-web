import type { Metadata } from "next";
import { loadServerLanguage } from "@/i18n/server";
import { TenantPortalRuntime } from "@/components/auth/TenantPortalRuntime";

export async function generateMetadata(): Promise<Metadata> {
  const { dictionary: t } = await loadServerLanguage();
  return { title: t.metadata.login };
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <TenantPortalRuntime>{children}</TenantPortalRuntime>;
}
