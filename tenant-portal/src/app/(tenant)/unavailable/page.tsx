import { UnavailableCapability } from "@/components/layout/UnavailableCapability";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

const BACK_ROUTES = {
  core: TENANT_ROUTES.coreSessions,
  crm: TENANT_ROUTES.crmHome,
  trade: TENANT_ROUTES.home,
} as const;

export default async function UnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string }>;
}) {
  const { module: tenantModule } = await searchParams;
  const backHref =
    tenantModule === "core"
      ? BACK_ROUTES.core
      : tenantModule === "crm"
        ? BACK_ROUTES.crm
        : tenantModule === "trade"
          ? BACK_ROUTES.trade
          : TENANT_ROUTES.home;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-[#090d16]">
      <main className="w-full flex-1 p-4">
        <UnavailableCapability backHref={backHref} />
      </main>
    </div>
  );
}
