import { SubscriptionDetailScreen } from "@/features/admin/subscriptions/SubscriptionDetailScreen";

export default async function SubscriptionDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  return <SubscriptionDetailScreen tenantId={tenantId} />;
}
