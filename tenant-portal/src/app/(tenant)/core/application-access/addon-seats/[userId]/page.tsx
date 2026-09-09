import { notFound } from "next/navigation";
import { applicationAccessSchemas } from "../../application-access-contract";
import { AddonSeatWorkspace } from "../../components/AddonSeatWorkspace";

export default async function UserAddonSeatsPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  if (!applicationAccessSchemas.uuid.safeParse(userId).success) notFound();
  return <AddonSeatWorkspace userId={userId} />;
}
