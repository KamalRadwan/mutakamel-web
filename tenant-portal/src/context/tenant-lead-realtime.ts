import type { CrmLeadsChangedPayloadV1 } from "@mutakamel/realtime-app-client";

type LeadRealtimeSignal = { generation: string } & (
  | { kind: "ready" | "resync" }
  | { kind: "changed"; payload: CrmLeadsChangedPayloadV1 }
);

const listeners = new Set<(signal: LeadRealtimeSignal) => void>();
let readyGeneration: string | null = null;

/** Only the provider publishes here, after the application client's validation. */
export function publishTenantLeadRealtime(signal: LeadRealtimeSignal): void {
  if (signal.kind === "ready") readyGeneration = signal.generation;
  for (const listener of listeners) listener(signal);
}

export function clearTenantLeadRealtime(generation?: string): void {
  if (generation === undefined || readyGeneration === generation) readyGeneration = null;
}

export function subscribeTenantLeadRealtime(listener: (signal: LeadRealtimeSignal) => void): () => void {
  listeners.add(listener);
  // A workspace can mount after session.ready has already arrived.
  if (readyGeneration !== null) listener({ generation: readyGeneration, kind: "ready" });
  return () => { listeners.delete(listener); };
}
