import { UnavailableState } from "@/design-system";
import { TENANT_ROUTES } from "@/lib/navigation/tenant-routes";

export default function TradeIndexPage() {
  return <UnavailableState backHref={TENANT_ROUTES.home} />;
}
