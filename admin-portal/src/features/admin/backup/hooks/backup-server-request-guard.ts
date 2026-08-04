export interface BackupServerRequestIdentity {
  requestServerId: string;
  selectedServerId: string;
  requestGeneration: number;
  currentGeneration: number;
}

export function isCurrentBackupServerRequest({
  requestServerId,
  selectedServerId,
  requestGeneration,
  currentGeneration,
}: BackupServerRequestIdentity): boolean {
  return (
    requestServerId.length > 0 &&
    requestServerId === selectedServerId &&
    requestGeneration === currentGeneration
  );
}

export function ownsSelectedBackupServerState(
  selectedServerId: string,
  loadedServerId: string | null,
): boolean {
  return selectedServerId.length > 0 && selectedServerId === loadedServerId;
}

export function resolveBackupServerSelection(
  availableServerIds: readonly string[],
  requestedServerId: string,
  currentServerId: string,
): string {
  if (requestedServerId) {
    return availableServerIds.includes(requestedServerId)
      ? requestedServerId
      : "";
  }
  if (currentServerId && availableServerIds.includes(currentServerId)) {
    return currentServerId;
  }
  return availableServerIds[0] ?? "";
}
