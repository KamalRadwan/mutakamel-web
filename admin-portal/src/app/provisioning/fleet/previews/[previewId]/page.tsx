import { FleetPreviewScreen } from "@/features/admin/provisioning-fleet/FleetPreviewScreen";

export default async function ProvisioningFleetPreviewPage({
  params,
}: {
  params: Promise<{ previewId: string }>;
}) {
  const { previewId } = await params;
  return <FleetPreviewScreen previewId={previewId} />;
}

