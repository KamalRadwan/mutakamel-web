import { FleetRolloutScreen } from "@/features/admin/provisioning-fleet/FleetRolloutScreen";

export default async function ProvisioningFleetRolloutPage({
  params,
}: {
  params: Promise<{ rolloutId: string }>;
}) {
  const { rolloutId } = await params;
  return <FleetRolloutScreen rolloutId={rolloutId} />;
}

