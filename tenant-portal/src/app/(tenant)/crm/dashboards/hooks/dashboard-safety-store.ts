interface DashboardSafetyEntry {
  version: number;
  epoch: number;
  pending: symbol | null;
  unresolved: Map<string, boolean>;
  listeners: Set<() => void>;
}

// Uncertain writes survive modal and resource remounts within this auth session.
const entries = new Map<string, DashboardSafetyEntry>();
export function dashboardSafetyEntry(key: string): DashboardSafetyEntry {
  let entry = entries.get(key);
  if (!entry) {
    entry = { version: 0, epoch: 0, pending: null, unresolved: new Map(), listeners: new Set() };
    entries.set(key, entry);
  }
  return entry;
}
function changed(entry: DashboardSafetyEntry) {
  entry.version++;
  entry.listeners.forEach((listener) => listener());
}
export function acquireDashboardWrite(entry: DashboardSafetyEntry) {
  if (entry.pending || entry.unresolved.size) return null;
  const token = Symbol("dashboard-write");
  entry.pending = token;
  entry.epoch++;
  changed(entry);
  return token;
}
export function finishDashboardWrite(entry: DashboardSafetyEntry, token: symbol) {
  if (entry.pending !== token) return;
  entry.pending = null;
  changed(entry);
}
export function fenceDashboardWrite(entry: DashboardSafetyEntry, token: symbol, resource: string) {
  if (entry.pending !== token) return;
  entry.unresolved.set(resource, false);
  entry.epoch++;
  changed(entry);
}
export function confirmDashboardRead(entry: DashboardSafetyEntry, resource: string) {
  if (!entry.unresolved.has(resource)) return;
  entry.unresolved.set(resource, true);
  changed(entry);
}
export function reviewDashboardRead(entry: DashboardSafetyEntry) {
  if (entry.pending || [...entry.unresolved.values()].some((ready) => !ready)) return;
  entry.unresolved.clear();
  changed(entry);
}
