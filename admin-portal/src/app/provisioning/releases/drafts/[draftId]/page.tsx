import { ReleaseDraftDetailScreen } from "@/features/admin/provisioning-releases/components/release-draft-detail-screen";

export default async function ProvisioningReleaseDraftPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await params;
  return <ReleaseDraftDetailScreen draftId={draftId} />;
}
