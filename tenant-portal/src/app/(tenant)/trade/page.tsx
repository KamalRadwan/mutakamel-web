import { UnavailableCapability } from "@/components/layout/UnavailableCapability";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

export default function TradeIndexPage() {
  return <UnavailableCapability backHref={TENANT_ROUTES.home} />;
}
