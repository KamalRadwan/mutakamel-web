import { generateUUIDv7 } from "@/lib/utils/uuid";

/**
 * Keeps a caller-owned UUIDv7 attached to an exact command until the caller
 * observes a definitive result. Ambiguous retries reuse the same identity;
 * success, deterministic rejection, or a changed payload gets a fresh one.
 */
export class TenantAccessCommandIdentities {
  private readonly keys = new Map<string, string>();

  keyFor(intent: unknown): string {
    const fingerprint = stableFingerprint(intent);
    const existing = this.keys.get(fingerprint);
    if (existing) return existing;
    const created = generateUUIDv7();
    this.keys.set(fingerprint, created);
    return created;
  }

  complete(intent: unknown): void {
    this.keys.delete(stableFingerprint(intent));
  }

  clear(): void {
    this.keys.clear();
  }
}

function stableFingerprint(value: unknown): string {
  const serialized = stableSerialize(value);
  // Four independent 32-bit lanes keep sensitive command bodies out of Map
  // keys while making an accidental collision impractical for UI retries.
  const lanes = [0x811c9dc5, 0x9e3779b9, 0x85ebca6b, 0xc2b2ae35];
  for (let index = 0; index < serialized.length; index += 1) {
    const code = serialized.charCodeAt(index);
    for (let lane = 0; lane < lanes.length; lane += 1) {
      lanes[lane] = Math.imul((lanes[lane] ?? 0) ^ (code + lane * 131), 0x01000193);
    }
  }
  return lanes.map((lane) => (lane >>> 0).toString(16).padStart(8, "0")).join("");
}

export function stableSerialize(value: unknown): string {
  const seen = new WeakSet<object>();
  const normalize = (candidate: unknown): unknown => {
    if (candidate === null || typeof candidate !== "object") return candidate;
    if (seen.has(candidate)) throw new Error("CYCLIC_TENANT_ACCESS_COMMAND");
    seen.add(candidate);
    if (Array.isArray(candidate)) return candidate.map(normalize);
    return Object.fromEntries(
      Object.entries(candidate as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalize(entry)]),
    );
  };
  return JSON.stringify(normalize(value)) ?? String(value);
}
