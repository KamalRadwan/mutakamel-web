import { axiosClient } from "@/lib/api/axiosClient";
import {
  isUuidV7,
  readPublisherKey,
  readPublisherKeyChallenge,
  readPublisherKeys,
} from "./readers";
import type {
  CreateChallengeCommand,
  RegisterPublisherKeyCommand,
  RevokePublisherKeyCommand,
} from "./types";

export const PUBLISHER_KEYS_URL =
  "/api/admin/core/v1/provisioning/publisher-keys";

export const publisherKeysApi = {
  list: async (signal?: AbortSignal) => {
    const response = await axiosClient.get<unknown>(
      PUBLISHER_KEYS_URL,
      readConfig(signal),
    );
    return readPublisherKeys(response.data);
  },

  get: async (publisherKeyId: string, signal?: AbortSignal) => {
    requireUuidV7(publisherKeyId, "INVALID_PUBLISHER_KEY_ID");
    const response = await axiosClient.get<unknown>(
      `${PUBLISHER_KEYS_URL}/${encodeURIComponent(publisherKeyId)}`,
      readConfig(signal),
    );
    return readPublisherKey(response.data);
  },

  createChallenge: async (
    command: CreateChallengeCommand,
    idempotencyKey: string,
  ) => {
    validateChallenge(command);
    const response = await axiosClient.post<unknown>(
      `${PUBLISHER_KEYS_URL}/challenges`,
      command,
      writeConfig(idempotencyKey),
    );
    return readPublisherKeyChallenge(response.data);
  },

  register: async (
    command: RegisterPublisherKeyCommand,
    idempotencyKey: string,
  ) => {
    validateRegister(command);
    const response = await axiosClient.post<unknown>(
      PUBLISHER_KEYS_URL,
      command,
      writeConfig(idempotencyKey),
    );
    return readPublisherKey(response.data);
  },

  revoke: async (
    publisherKeyId: string,
    command: RevokePublisherKeyCommand,
    idempotencyKey: string,
  ) => {
    requireUuidV7(publisherKeyId, "INVALID_PUBLISHER_KEY_ID");
    validateRevoke(command);
    const response = await axiosClient.post<unknown>(
      `${PUBLISHER_KEYS_URL}/${encodeURIComponent(publisherKeyId)}/revoke`,
      command,
      writeConfig(idempotencyKey),
    );
    return readPublisherKey(response.data);
  },
};

function readConfig(signal?: AbortSignal) {
  return { cache: "no-store" as const, ...(signal ? { signal } : {}) };
}

function writeConfig(idempotencyKey: string) {
  requireUuidV7(idempotencyKey, "INVALID_IDEMPOTENCY_KEY");
  return {
    headers: { "x-idempotency-key": idempotencyKey },
    skipAutoIdempotency: true,
    replayAfterRefresh: true,
    cache: "no-store" as const,
  };
}

function validateChallenge(command: CreateChallengeCommand): void {
  if (
    !hasExactKeys(command, ["keyId", "publicKeyBase64", "expiresInSeconds"]) ||
    !/^[a-z][a-z0-9._-]{2,63}$/u.test(command.keyId) ||
    !/^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/u.test(
      command.publicKeyBase64,
    ) ||
    !Number.isSafeInteger(command.expiresInSeconds) ||
    command.expiresInSeconds < 60 ||
    command.expiresInSeconds > 900
  ) {
    throw new TypeError("INVALID_PUBLISHER_KEY_CHALLENGE");
  }
}

function validateRegister(command: RegisterPublisherKeyCommand): void {
  if (
    !hasExactKeys(command, ["challengeId", "proofSignatureBase64"]) ||
    !isUuidV7(command.challengeId) ||
    !/^[A-Za-z0-9+/]{85}[AQgw]==$/u.test(command.proofSignatureBase64)
  ) {
    throw new TypeError("INVALID_PUBLISHER_KEY_REGISTRATION");
  }
}

function validateRevoke(command: RevokePublisherKeyCommand): void {
  if (
    !hasExactKeys(command, [
      "expectedRevision",
      "expectedStatus",
      "reasonCode",
    ]) ||
    !Number.isSafeInteger(command.expectedRevision) ||
    command.expectedRevision < 1 ||
    command.expectedRevision > 2_147_483_647 ||
    command.expectedStatus !== "ACTIVE" ||
    !/^[A-Z][A-Z0-9._-]{2,95}$/u.test(command.reasonCode)
  ) {
    throw new TypeError("INVALID_PUBLISHER_KEY_REVOCATION");
  }
}

function requireUuidV7(value: string, code: string): void {
  if (!isUuidV7(value)) throw new TypeError(code);
}

function hasExactKeys(value: object, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return (
    keys.length === wanted.length &&
    keys.every((entry, index) => entry === wanted[index])
  );
}
