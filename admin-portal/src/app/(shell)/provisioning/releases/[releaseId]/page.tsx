import { ReleaseDetailScreen } from "@/features/admin/provisioning-releases/components/release-detail-screen";

export default async function ProvisioningReleasePage({
  params,
}: {
  params: Promise<{ releaseId: string }>;
}) {
  const { releaseId } = await params;
  return <ReleaseDetailScreen releaseId={releaseId} />;
}
