import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { useIdempotency } from "@/shared/hooks/useIdempotency";
import { databaseServersApi } from "../api/database-servers.api";
import { shouldResetDatabaseServerWriteKey } from "../lib/database-server-idempotency";
import type {
  CheckDatabaseServerConnectivityDto,
  CreateDatabaseServerDto,
} from "../types";

/** Registration mutations only; mounting this hook never loads the server list. */
export function useDatabaseServerRegistration() {
  const createIntent = useIdempotency();
  const diagnosticIntent = useIdempotency();
  const bootstrapIntent = useIdempotency();
  const activationIntent = useIdempotency();

  const createServer = async (dto: CreateDatabaseServerDto) => {
    try {
      const key = createIntent.getIdempotencyKey(dto);
      const server = await databaseServersApi.create(dto, key);
      createIntent.resetKey();
      return server;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        createIntent.resetKey();
      }
      throw normalized;
    }
  };

  const activateServer = async (databaseServerId: string) => {
    try {
      const key = activationIntent.getIdempotencyKey({
        action: "activate",
        databaseServerId,
      });
      const server = await databaseServersApi.activate(databaseServerId, key);
      activationIntent.resetKey();
      return server;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        activationIntent.resetKey();
      }
      throw normalized;
    }
  };

  const checkConnectivity = async (
    dto: CheckDatabaseServerConnectivityDto,
  ) => {
    try {
      const key = diagnosticIntent.getIdempotencyKey(dto);
      const result = await databaseServersApi.checkConnectivity(dto, key);
      diagnosticIntent.resetKey();
      return result;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        diagnosticIntent.resetKey();
      }
      throw normalized;
    }
  };

  const retryBootstrap = async (databaseServerId: string) => {
    const dto = { reason: "Retry automatic registration bootstrap" };
    try {
      const key = bootstrapIntent.getIdempotencyKey({
        action: "retry-bootstrap",
        databaseServerId,
        ...dto,
      });
      const server = await databaseServersApi.retryBootstrap(
        databaseServerId,
        dto,
        key,
      );
      bootstrapIntent.resetKey();
      return server;
    } catch (error) {
      const normalized = normalizeApiError(error);
      if (shouldResetDatabaseServerWriteKey(normalized)) {
        bootstrapIntent.resetKey();
      }
      throw normalized;
    }
  };

  return {
    createServer,
    checkConnectivity,
    activateServer,
    retryBootstrap,
  };
}
