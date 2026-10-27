/** Only the immutable confirmation command is retained; no wallet/FX snapshot. */
export interface WalletConfirmation {
  actorId: string;
  tenantId: string;
  quoteId: string;
  note: string;
  key: string;
}

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function walletConfirmationStorageKey(actorId: string, tenantId: string): string {
  return `admin.wallet-confirmation:${encodeURIComponent(actorId)}:${encodeURIComponent(tenantId)}`;
}

export function readWalletConfirmation(actorId: string, tenantId: string): WalletConfirmation | null {
  const raw = window.localStorage.getItem(walletConfirmationStorageKey(actorId, tenantId));
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object") throw new Error("Invalid wallet recovery record");
  const row = value as Record<string, unknown>;
  if (
    row.actorId !== actorId || row.tenantId !== tenantId ||
    typeof row.quoteId !== "string" || !UUID_V7.test(row.quoteId) ||
    typeof row.key !== "string" || !UUID_V7.test(row.key) ||
    typeof row.note !== "string" || row.note !== row.note.trim() ||
    row.note.length < 1 || row.note.length > 255
  ) throw new Error("Invalid wallet recovery record");
  return { actorId, tenantId, quoteId: row.quoteId, note: row.note, key: row.key };
}

export function saveWalletConfirmation(command: WalletConfirmation): WalletConfirmation {
  // Never overwrite an unresolved command with changed input or a new key.
  const existing = readWalletConfirmation(command.actorId, command.tenantId);
  if (existing) return existing;
  window.localStorage.setItem(
    walletConfirmationStorageKey(command.actorId, command.tenantId),
    JSON.stringify(command),
  );
  const saved = readWalletConfirmation(command.actorId, command.tenantId);
  if (!saved) throw new Error("Wallet recovery record was not saved");
  return saved;
}

export function clearWalletConfirmation(command: WalletConfirmation): void {
  const existing = readWalletConfirmation(command.actorId, command.tenantId);
  if (existing?.key !== command.key) return;
  window.localStorage.removeItem(walletConfirmationStorageKey(command.actorId, command.tenantId));
  if (readWalletConfirmation(command.actorId, command.tenantId)) {
    throw new Error("Wallet recovery record was not cleared");
  }
}
