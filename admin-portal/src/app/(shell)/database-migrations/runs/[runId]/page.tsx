import { MigrationRunDetailScreen } from "@/features/admin/database-migrations/components/migration-run-detail-screen";

export default async function DatabaseMigrationRunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  return <MigrationRunDetailScreen runId={runId} />;
}
