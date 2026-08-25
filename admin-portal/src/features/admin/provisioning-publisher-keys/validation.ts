import { isUuidV7 } from "./readers";
import type {
  ChallengeDraft,
  CreateChallengeCommand,
  FieldErrors,
  RegisterDraft,
  RegisterPublisherKeyCommand,
  RevokeDraft,
  RevokePublisherKeyCommand,
} from "./types";

const KEY_ID = /^[a-z][a-z0-9._-]{2,63}$/u;
const RAW_ED25519_PUBLIC_KEY_BASE64 =
  /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/u;
const ED25519_SIGNATURE_BASE64 = /^[A-Za-z0-9+/]{85}[AQgw]==$/u;
const SAFE_CODE = /^[A-Z][A-Z0-9._-]{2,95}$/u;

export function buildChallengeCommand(draft: ChallengeDraft): {
  command: CreateChallengeCommand | null;
  errors: FieldErrors<keyof ChallengeDraft>;
} {
  const errors: FieldErrors<keyof ChallengeDraft> = {};
  if (!KEY_ID.test(draft.keyId)) errors.keyId = "KEY_ID";
  if (!RAW_ED25519_PUBLIC_KEY_BASE64.test(draft.publicKeyBase64)) {
    errors.publicKeyBase64 = "PUBLIC_KEY";
  }
  if (!/^(?:[1-9][0-9]{1,2})$/u.test(draft.expiresInSeconds)) {
    errors.expiresInSeconds = "EXPIRY";
  }
  const expiresInSeconds = Number(draft.expiresInSeconds);
  if (
    !Number.isSafeInteger(expiresInSeconds) ||
    expiresInSeconds < 60 ||
    expiresInSeconds > 900
  ) {
    errors.expiresInSeconds = "EXPIRY";
  }
  return Object.keys(errors).length
    ? { command: null, errors }
    : {
        command: {
          keyId: draft.keyId,
          publicKeyBase64: draft.publicKeyBase64,
          expiresInSeconds,
        },
        errors,
      };
}

export function buildRegisterCommand(draft: RegisterDraft): {
  command: RegisterPublisherKeyCommand | null;
  errors: FieldErrors<keyof RegisterDraft>;
} {
  const errors: FieldErrors<keyof RegisterDraft> = {};
  if (!isUuidV7(draft.challengeId)) errors.challengeId = "CHALLENGE_ID";
  if (!ED25519_SIGNATURE_BASE64.test(draft.proofSignatureBase64)) {
    errors.proofSignatureBase64 = "SIGNATURE";
  }
  return Object.keys(errors).length
    ? { command: null, errors }
    : {
        command: {
          challengeId: draft.challengeId,
          proofSignatureBase64: draft.proofSignatureBase64,
        },
        errors,
      };
}

export function buildRevokeCommand(
  draft: RevokeDraft,
): {
  target: {
    publisherKeyId: string;
    command: RevokePublisherKeyCommand;
  } | null;
  errors: FieldErrors<keyof RevokeDraft>;
} {
  const errors: FieldErrors<keyof RevokeDraft> = {};
  if (!isUuidV7(draft.publisherKeyId)) {
    errors.publisherKeyId = "PUBLISHER_KEY_ID";
  }
  if (!/^[1-9][0-9]{0,9}$/u.test(draft.expectedRevision)) {
    errors.expectedRevision = "REVISION";
  }
  const expectedRevision = Number(draft.expectedRevision);
  if (!SAFE_CODE.test(draft.reasonCode)) errors.reasonCode = "REASON";
  if (
    !Number.isSafeInteger(expectedRevision) ||
    expectedRevision < 1 ||
    expectedRevision > 2_147_483_647
  ) {
    errors.expectedRevision = "REVISION";
  }
  return Object.keys(errors).length
    ? { target: null, errors }
    : {
        target: {
          publisherKeyId: draft.publisherKeyId,
          command: {
            expectedRevision,
            expectedStatus: "ACTIVE",
            reasonCode: draft.reasonCode,
          },
        },
        errors,
      };
}
