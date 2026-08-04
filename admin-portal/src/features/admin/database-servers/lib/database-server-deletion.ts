import type { DatabaseServerView } from "../types";

export function canSoftDeleteDatabaseServer(
  server: Pick<DatabaseServerView, "status" | "currentTenants" | "deletedAt">,
): boolean {
  return (
    server.deletedAt === null &&
    (server.status === "DRAINING" || server.status === "OFFLINE") &&
    server.currentTenants === 0
  );
}

export function canDestroyDatabaseServer(
  server: Pick<DatabaseServerView, "deletedAt">,
): boolean {
  return server.deletedAt !== null;
}
