export interface WorkerEventKey {
  verificationKeyId: string;
  issuer: string;
  keyId: string;
  algorithm: "RS256";
  publicKeyFingerprint: string;
  status: "ACTIVE" | "RETIRED" | "REVOKED";
  revision: number;
  registeredAt: string;
}

export interface AdoptWorkerKey {
  trustSlot: "ACTIVE" | "PREVIOUS";
  expectedIssuer: string;
  expectedKeyId: string;
  expectedPublicKeyFingerprint: string;
}

export type ConfiguredWorkerKey = Pick<WorkerEventKey, "issuer" | "keyId" | "algorithm" | "publicKeyFingerprint"> & {
  trustSlot: "ACTIVE" | "PREVIOUS";
};
export const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISSUER = /^[\x21-\x7e]{1,256}$/;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const FINGERPRINT = /^[0-9a-f]{64}$/;
export type FieldErrors = Partial<Record<keyof AdoptWorkerKey, true>>;

export function validateAdoption(draft: AdoptWorkerKey): FieldErrors {
  return {
    ...(!["ACTIVE", "PREVIOUS"].includes(draft.trustSlot) && { trustSlot: true }),
    ...(!ISSUER.test(draft.expectedIssuer) && { expectedIssuer: true }),
    ...(!KEY_ID.test(draft.expectedKeyId) && { expectedKeyId: true }),
    ...(!FINGERPRINT.test(draft.expectedPublicKeyFingerprint) && { expectedPublicKeyFingerprint: true }),
  };
}

function invalid(): never { throw new Error("INVALID_WORKER_EVENT_KEY_RESPONSE"); }
export function readConfiguredKey(input: unknown): ConfiguredWorkerKey {
  if (!input || typeof input !== "object") return invalid();
  const row = input as Record<string, unknown>;
  if ((row.trustSlot !== "ACTIVE" && row.trustSlot !== "PREVIOUS")
    || typeof row.issuer !== "string" || !ISSUER.test(row.issuer)
    || typeof row.keyId !== "string" || !KEY_ID.test(row.keyId)
    || row.algorithm !== "RS256"
    || typeof row.publicKeyFingerprint !== "string" || !FINGERPRINT.test(row.publicKeyFingerprint)) return invalid();
  return { trustSlot: row.trustSlot, issuer: row.issuer, keyId: row.keyId,
    algorithm: "RS256", publicKeyFingerprint: row.publicKeyFingerprint };
}
export function readWorkerKey(input: unknown): WorkerEventKey {
  if (!input || typeof input !== "object") return invalid();
  const row = input as Record<string, unknown>;
  if (typeof row.verificationKeyId !== "string" || !UUID_V7.test(row.verificationKeyId)
    || typeof row.issuer !== "string" || !ISSUER.test(row.issuer)
    || typeof row.keyId !== "string" || !KEY_ID.test(row.keyId)
    || row.algorithm !== "RS256"
    || typeof row.publicKeyFingerprint !== "string" || !FINGERPRINT.test(row.publicKeyFingerprint)
    || !["ACTIVE", "RETIRED", "REVOKED"].includes(String(row.status))
    || typeof row.revision !== "number" || !Number.isInteger(row.revision) || row.revision < 1
    || typeof row.registeredAt !== "string" || !Number.isFinite(Date.parse(row.registeredAt))) return invalid();
  // Deliberately project only safe identity/history fields, never key material.
  return { verificationKeyId: row.verificationKeyId, issuer: row.issuer, keyId: row.keyId,
    algorithm: "RS256", publicKeyFingerprint: row.publicKeyFingerprint,
    status: row.status as WorkerEventKey["status"], revision: row.revision, registeredAt: row.registeredAt };
}

export function envelopeData(input: unknown): unknown {
  if (!input || typeof input !== "object" || !("success" in input) || input.success !== true || !("data" in input)) return invalid();
  return input.data;
}
