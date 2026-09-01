import { sha256 } from "@noble/hashes/sha2.js";
import type { ReleaseDraft } from "../types/provisioning-releases";
import { canonicalJson } from "./release-validation";

export interface SigningPayloadEvidence {
  payloadBase64: string;
  computedDigest: string;
  matchesCoreDigest: boolean;
}

export async function buildVerifiedSigningPayload(
  draft: ReleaseDraft,
): Promise<SigningPayloadEvidence> {
  if (draft.status !== "VALIDATED" || !draft.publisherKeyId || !draft.signingDigest) {
    throw new Error("INVALID_PROVISIONING_RELEASE_SIGNING_STATE");
  }
  const payload = canonicalJson({
    schemaVersion: 1,
    purpose: "PROVISIONING_RELEASE_PUBLICATION",
    draftId: draft.draftId,
    revision: draft.revision,
    publisherKeyId: draft.publisherKeyId,
    componentId: draft.componentId,
    releaseVersion: draft.releaseVersion,
    manifestVersion: draft.manifestVersion,
    contractVersion: draft.contractVersion,
    runtimeBuildSha: draft.runtimeBuildSha,
    schemaTarget: draft.schemaTarget,
    schemaChecksum: draft.schemaChecksum,
    manifestChecksum: draft.manifestChecksum,
    manifestPayload: draft.manifestPayload,
    compatibility: draft.compatibility,
    riskLevel: draft.riskLevel,
    selfServiceAllowed: draft.selfServiceAllowed,
    requiresBackup: draft.requiresBackup,
    requiresMaintenance: draft.requiresMaintenance,
  });
  const bytes = new TextEncoder().encode(payload);
  // This verifies a digest, not a private-key signature, and must work on HTTP.
  const digest = sha256(bytes);
  const computedDigest = Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return {
    payloadBase64: btoa(binary),
    computedDigest,
    matchesCoreDigest: computedDigest === draft.signingDigest,
  };
}
