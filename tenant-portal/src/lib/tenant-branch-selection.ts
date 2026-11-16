import { safeSessionStorage } from "@/lib/safeStorage";
import { isUUIDv7 } from "@/lib/uuid";

const selections = new Map<string, string | null>();
const subscribers = new Map<string, Set<() => void>>();

export function tenantBranchSelectionKey(actorId: string): string {
  return `tenant_branch_selection_v1:${encodeURIComponent(actorId)}`;
}

export function readTenantBranchSelection(actorId: string): string | null {
  if (typeof window === "undefined") return null;
  if (!selections.has(actorId)) {
    const stored = safeSessionStorage.getItem(tenantBranchSelectionKey(actorId));
    selections.set(actorId, isUUIDv7(stored) ? stored : null);
  }
  return selections.get(actorId) ?? null;
}

export function subscribeTenantBranchSelection(actorId: string, listener: () => void): () => void {
  const listeners = subscribers.get(actorId) ?? new Set<() => void>();
  listeners.add(listener);
  subscribers.set(actorId, listeners);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) subscribers.delete(actorId);
  };
}

export function writeTenantBranchSelection(actorId: string, branchId: string | null): void {
  if (readTenantBranchSelection(actorId) === branchId) return;
  selections.set(actorId, branchId);
  const key = tenantBranchSelectionKey(actorId);
  if (branchId === null) safeSessionStorage.removeItem(key);
  else safeSessionStorage.setItem(key, branchId);
  // The browser's storage event does not update other consumers in this tab.
  subscribers.get(actorId)?.forEach((listener) => listener());
}
