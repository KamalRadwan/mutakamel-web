"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getApiRequestOutcome } from "@/lib/api/axiosClient";
import { adminCan, adminCanAll } from "@/lib/auth/rbac";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { publisherKeysApi } from "./api";
import type {
  ChallengeDraft,
  ContractResult,
  FieldErrors,
  MutationKind,
  MutationState,
  PublisherKey,
  PublisherKeyChallenge,
  PublisherKeyMutationIntent,
  RegisterDraft,
  ResourceState,
  ResourceView,
  RevokeDraft,
} from "./types";
import {
  buildChallengeCommand,
  buildRegisterCommand,
  buildRevokeCommand,
} from "./validation";

const INITIAL_CHALLENGE_DRAFT: ChallengeDraft = {
  keyId: "",
  publicKeyBase64: "",
  expiresInSeconds: "300",
};
const INITIAL_REGISTER_DRAFT: RegisterDraft = {
  challengeId: "",
  proofSignatureBase64: "",
};
const INITIAL_REVOKE_DRAFT: RevokeDraft = {
  publisherKeyId: "",
  expectedRevision: "",
  reasonCode: "",
};

interface OwnedResource<T> extends ResourceView<T> {
  ownerId: string | null;
}

function emptyResource<T>(): OwnedResource<T> {
  return {
    ownerId: null,
    data: null,
    state: "LOADING",
    error: null,
    correlationId: null,
    timestamp: null,
    isRefreshing: false,
  };
}

export function usePublisherKeys() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const ownerId = user?.id ?? null;
  const ownerRef = useRef(ownerId);
  const canRead = adminCan(user, "admin.provisioning.publisher-keys.read");
  const canManage = adminCan(
    user,
    "admin.provisioning.publisher-keys.manage",
  );
  const canCritical = adminCan(user, "admin.provisioning.critical");
  const canRegisterOrRevoke = adminCanAll(user, [
    "admin.provisioning.publisher-keys.manage",
    "admin.provisioning.critical",
  ]);

  const [listRevision, setListRevision] = useState(0);
  const [directory, setDirectory] =
    useState<OwnedResource<PublisherKey[]>>(emptyResource);
  const directoryRef = useRef<OwnedResource<PublisherKey[]>>(emptyResource());

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailRevision, setDetailRevision] = useState(0);
  const [detail, setDetail] = useState<OwnedResource<PublisherKey>>(
    emptyResource,
  );
  const detailRef = useRef<OwnedResource<PublisherKey>>(emptyResource());

  const [challengeDraft, setChallengeDraft] = useState<ChallengeDraft>(
    INITIAL_CHALLENGE_DRAFT,
  );
  const [challengeErrors, setChallengeErrors] = useState<
    FieldErrors<keyof ChallengeDraft>
  >({});
  const [registerDraft, setRegisterDraft] = useState<RegisterDraft>(
    INITIAL_REGISTER_DRAFT,
  );
  const [registerErrors, setRegisterErrors] = useState<
    FieldErrors<keyof RegisterDraft>
  >({});
  const [revokeDraft, setRevokeDraft] = useState<RevokeDraft>(
    INITIAL_REVOKE_DRAFT,
  );
  const [revokeErrors, setRevokeErrors] = useState<
    FieldErrors<keyof RevokeDraft>
  >({});

  const [challengeResult, setChallengeResult] = useState<ContractResult<
    PublisherKeyChallenge
  > | null>(null);
  const [challengeOwnerId, setChallengeOwnerId] = useState<string | null>(null);
  const [mutationState, setMutationState] = useState<MutationState>("IDLE");
  const [mutationKind, setMutationKind] = useState<MutationKind | null>(null);
  const [mutationError, setMutationError] =
    useState<NormalizedApiError | null>(null);
  const [mutationCorrelationId, setMutationCorrelationId] = useState<
    string | null
  >(null);
  const [mutationResult, setMutationResult] =
    useState<PublisherKey | null>(null);
  const [mutationOwnerId, setMutationOwnerId] = useState<string | null>(null);
  const [pendingIntent, setPendingIntent] =
    useState<PublisherKeyMutationIntent | null>(null);
  const [retryIntent, setRetryIntent] =
    useState<PublisherKeyMutationIntent | null>(null);
  const inFlightRef = useRef(false);
  const attemptRef = useRef(0);

  useEffect(() => {
    ownerRef.current = ownerId;
    attemptRef.current += 1;
    inFlightRef.current = false;
    queueMicrotask(() => {
      if (ownerRef.current !== ownerId) return;
      setPendingIntent(null);
      setRetryIntent(null);
      setMutationState("IDLE");
      setMutationKind(null);
      setMutationError(null);
      setMutationCorrelationId(null);
      setMutationResult(null);
      setMutationOwnerId(null);
      setChallengeResult(null);
      setChallengeOwnerId(null);
    });
  }, [ownerId]);

  useEffect(() => {
    if (isAuthLoading || !canRead || !ownerId) return;
    const controller = new AbortController();
    let disposed = false;
    const load = async () => {
      const previous =
        directoryRef.current.ownerId === ownerId
          ? directoryRef.current.data
          : null;
      setDirectory({
        ownerId,
        data: previous,
        state: previous ? directoryRef.current.state : "LOADING",
        error: null,
        correlationId: directoryRef.current.correlationId,
        timestamp: directoryRef.current.timestamp,
        isRefreshing: previous !== null,
      });
      try {
        const result = await publisherKeysApi.list(controller.signal);
        if (disposed || ownerRef.current !== ownerId) return;
        const next: OwnedResource<PublisherKey[]> = {
          ownerId,
          data: result.data,
          state: result.data.length ? "READY" : "EMPTY",
          error: null,
          correlationId: result.correlationId,
          timestamp: result.timestamp,
          isRefreshing: false,
        };
        directoryRef.current = next;
        setDirectory(next);
      } catch (caught) {
        if (disposed || isAbortError(caught) || ownerRef.current !== ownerId) {
          return;
        }
        const error = normalizeApiError(caught);
        const next: OwnedResource<PublisherKey[]> = {
          ownerId,
          data: previous,
          state: previous ? "STALE" : classifyReadFailure(caught, error),
          error,
          correlationId: directoryRef.current.correlationId,
          timestamp: directoryRef.current.timestamp,
          isRefreshing: false,
        };
        directoryRef.current = next;
        setDirectory(next);
      }
    };
    queueMicrotask(() => {
      if (!disposed) void load();
    });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [canRead, isAuthLoading, listRevision, ownerId]);

  useEffect(() => {
    if (isAuthLoading || !canRead || !ownerId || !selectedId) return;
    const controller = new AbortController();
    let disposed = false;
    const load = async () => {
      const previous =
        detailRef.current.ownerId === ownerId &&
        detailRef.current.data?.publisherKeyId === selectedId
          ? detailRef.current.data
          : null;
      setDetail({
        ownerId,
        data: previous,
        state: previous ? detailRef.current.state : "LOADING",
        error: null,
        correlationId: detailRef.current.correlationId,
        timestamp: detailRef.current.timestamp,
        isRefreshing: previous !== null,
      });
      try {
        const result = await publisherKeysApi.get(selectedId, controller.signal);
        if (disposed || ownerRef.current !== ownerId) return;
        const next: OwnedResource<PublisherKey> = {
          ownerId,
          data: result.data,
          state: "READY",
          error: null,
          correlationId: result.correlationId,
          timestamp: result.timestamp,
          isRefreshing: false,
        };
        detailRef.current = next;
        setDetail(next);
        setRevokeDraft((current) => ({
          publisherKeyId: result.data.publisherKeyId,
          expectedRevision: String(result.data.revision),
          reasonCode:
            current.publisherKeyId === result.data.publisherKeyId
              ? current.reasonCode
              : "",
        }));
      } catch (caught) {
        if (disposed || isAbortError(caught) || ownerRef.current !== ownerId) {
          return;
        }
        const error = normalizeApiError(caught);
        const next: OwnedResource<PublisherKey> = {
          ownerId,
          data: previous,
          state: previous ? "STALE" : classifyReadFailure(caught, error),
          error,
          correlationId: detailRef.current.correlationId,
          timestamp: detailRef.current.timestamp,
          isRefreshing: false,
        };
        detailRef.current = next;
        setDetail(next);
      }
    };
    queueMicrotask(() => {
      if (!disposed) void load();
    });
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [canRead, detailRevision, isAuthLoading, ownerId, selectedId]);

  const clearMutation = useCallback(() => {
    if (inFlightRef.current) return;
    setMutationState("IDLE");
    setMutationKind(null);
    setMutationError(null);
    setMutationCorrelationId(null);
    setMutationResult(null);
    setMutationOwnerId(null);
    setPendingIntent(null);
    setRetryIntent(null);
  }, []);

  const performIntent = useCallback(
    async (intent: PublisherKeyMutationIntent) => {
      if (inFlightRef.current || !ownerId) return null;
      const allowed =
        intent.kind === "CHALLENGE" ? canManage : canRegisterOrRevoke;
      if (!allowed) {
        setMutationOwnerId(ownerId);
        setMutationKind(intent.kind);
        setMutationState("FORBIDDEN");
        return null;
      }
      const operationOwnerId = ownerId;
      const attempt = attemptRef.current + 1;
      attemptRef.current = attempt;
      inFlightRef.current = true;
      setMutationOwnerId(operationOwnerId);
      setMutationKind(intent.kind);
      setMutationState("PENDING");
      setMutationError(null);
      setMutationCorrelationId(null);
      setMutationResult(null);
      try {
        if (intent.kind === "CHALLENGE") {
          const result = await publisherKeysApi.createChallenge(
            intent.command,
            intent.idempotencyKey,
          );
          if (
            attemptRef.current !== attempt ||
            ownerRef.current !== operationOwnerId
          ) {
            return null;
          }
          setChallengeResult(result);
          setChallengeOwnerId(operationOwnerId);
          setRegisterDraft({
            challengeId: result.data.challengeId,
            proofSignatureBase64: "",
          });
          setMutationCorrelationId(result.correlationId);
        } else {
          const result =
            intent.kind === "REGISTER"
              ? await publisherKeysApi.register(
                  intent.command,
                  intent.idempotencyKey,
                )
              : await publisherKeysApi.revoke(
                  intent.publisherKeyId,
                  intent.command,
                  intent.idempotencyKey,
                );
          if (
            attemptRef.current !== attempt ||
            ownerRef.current !== operationOwnerId
          ) {
            return null;
          }
          setMutationResult(result.data);
          setMutationCorrelationId(result.correlationId);
          setSelectedId(result.data.publisherKeyId);
          const nextDetail: OwnedResource<PublisherKey> = {
            ownerId: operationOwnerId,
            data: result.data,
            state: "READY",
            error: null,
            correlationId: result.correlationId,
            timestamp: result.timestamp,
            isRefreshing: false,
          };
          detailRef.current = nextDetail;
          setDetail(nextDetail);
          setListRevision((current) => current + 1);
        }
        setPendingIntent(null);
        setRetryIntent(null);
        setMutationState("SUCCESS");
        return true;
      } catch (caught) {
        if (
          attemptRef.current !== attempt ||
          ownerRef.current !== operationOwnerId
        ) {
          return null;
        }
        const error = normalizeApiError(caught);
        const retain = retainAmbiguousIntent(caught, error);
        setMutationError(error);
        setMutationCorrelationId(error.correlationId ?? null);
        setPendingIntent(null);
        setRetryIntent(retain ? intent : null);
        setMutationState(
          retain ? "AMBIGUOUS" : classifyMutationFailure(error),
        );
        if (!retain && error.httpStatus === 409) {
          setListRevision((current) => current + 1);
          if (intent.kind === "REVOKE") {
            setDetailRevision((current) => current + 1);
          }
        }
        return null;
      } finally {
        if (attemptRef.current === attempt) inFlightRef.current = false;
      }
    },
    [canManage, canRegisterOrRevoke, ownerId],
  );

  const requestChallenge = useCallback(() => {
    setMutationOwnerId(ownerId);
    setMutationKind("CHALLENGE");
    if (!canManage || !ownerId) {
      setMutationState("FORBIDDEN");
      return false;
    }
    if (retryIntent || inFlightRef.current) return false;
    const built = buildChallengeCommand(challengeDraft);
    setChallengeErrors(built.errors);
    if (!built.command) {
      setMutationState("VALIDATION");
      return false;
    }
    const intent: PublisherKeyMutationIntent = {
      kind: "CHALLENGE",
      command: built.command,
      idempotencyKey: generateUUIDv7(),
    };
    void performIntent(intent);
    return true;
  }, [canManage, challengeDraft, ownerId, performIntent, retryIntent]);

  const requestRegister = useCallback(() => {
    setMutationOwnerId(ownerId);
    setMutationKind("REGISTER");
    if (!canRegisterOrRevoke || !ownerId) {
      setMutationState("FORBIDDEN");
      return false;
    }
    if (retryIntent || inFlightRef.current) return false;
    const built = buildRegisterCommand(registerDraft);
    setRegisterErrors(built.errors);
    if (!built.command) {
      setMutationState("VALIDATION");
      return false;
    }
    setMutationError(null);
    setPendingIntent({
      kind: "REGISTER",
      command: built.command,
      idempotencyKey: generateUUIDv7(),
    });
    setMutationState("CONFIRMING_REGISTER");
    return true;
  }, [canRegisterOrRevoke, ownerId, registerDraft, retryIntent]);

  const requestRevoke = useCallback(() => {
    setMutationOwnerId(ownerId);
    setMutationKind("REVOKE");
    if (!canRegisterOrRevoke || !ownerId) {
      setMutationState("FORBIDDEN");
      return false;
    }
    if (retryIntent || inFlightRef.current) {
      return false;
    }
    const built = buildRevokeCommand(revokeDraft);
    setRevokeErrors(built.errors);
    if (!built.target) {
      setMutationState("VALIDATION");
      return false;
    }
    setMutationError(null);
    setPendingIntent({
      kind: "REVOKE",
      publisherKeyId: built.target.publisherKeyId,
      command: built.target.command,
      idempotencyKey: generateUUIDv7(),
    });
    setMutationState("CONFIRMING_REVOKE");
    return true;
  }, [
    canRegisterOrRevoke,
    ownerId,
    retryIntent,
    revokeDraft,
  ]);

  const confirmMutation = useCallback(() => {
    if (pendingIntent) void performIntent(pendingIntent);
  }, [pendingIntent, performIntent]);

  const retryExactMutation = useCallback(() => {
    if (retryIntent) void performIntent(retryIntent);
  }, [performIntent, retryIntent]);

  const directoryView = visibleResource(
    directory,
    ownerId,
    canRead,
    isAuthLoading,
  );
  const detailView = selectedId
    ? visibleResource(detail, ownerId, canRead, isAuthLoading)
    : ({
        data: null,
        state: "EMPTY",
        error: null,
        correlationId: null,
        timestamp: null,
        isRefreshing: false,
      } satisfies ResourceView<PublisherKey>);
  const ownsMutation = ownerId !== null && mutationOwnerId === ownerId;
  const ownsChallenge =
    ownerId !== null && challengeOwnerId === ownerId && canManage;

  return {
    permissions: { canRead, canManage, canCritical, canRegisterOrRevoke },
    directory: directoryView,
    refreshDirectory: () => setListRevision((current) => current + 1),
    selectedId,
    selectKey: (publisherKeyId: string | null) => {
      setSelectedId(publisherKeyId);
      setRevokeDraft(INITIAL_REVOKE_DRAFT);
      setRevokeErrors({});
      if (!publisherKeyId) {
        detailRef.current = emptyResource();
        setDetail(emptyResource());
      }
    },
    detail: detailView,
    refreshDetail: () => setDetailRevision((current) => current + 1),
    challengeDraft,
    challengeErrors,
    setChallengeDraftField: <K extends keyof ChallengeDraft>(
      field: K,
      value: ChallengeDraft[K],
    ) => {
      setChallengeDraft((current) => ({ ...current, [field]: value }));
      setChallengeErrors((current) => ({ ...current, [field]: undefined }));
    },
    registerDraft,
    registerErrors,
    setRegisterDraftField: <K extends keyof RegisterDraft>(
      field: K,
      value: RegisterDraft[K],
    ) => {
      setRegisterDraft((current) => ({ ...current, [field]: value }));
      setRegisterErrors((current) => ({ ...current, [field]: undefined }));
    },
    revokeDraft,
    revokeErrors,
    setRevokeDraftField: <K extends keyof RevokeDraft>(
      field: K,
      value: RevokeDraft[K],
    ) => {
      setRevokeDraft((current) => ({ ...current, [field]: value }));
      setRevokeErrors((current) => ({ ...current, [field]: undefined }));
    },
    challengeResult: ownsChallenge ? challengeResult : null,
    mutation: {
      state: ownsMutation ? mutationState : "IDLE",
      kind: ownsMutation ? mutationKind : null,
      error: ownsMutation ? mutationError : null,
      correlationId: ownsMutation ? mutationCorrelationId : null,
      result: ownsMutation ? mutationResult : null,
      pendingIntent: ownsMutation ? pendingIntent : null,
      exactRetryAvailable: ownsMutation && retryIntent !== null,
    },
    requestChallenge,
    requestRegister,
    requestRevoke,
    confirmMutation,
    closeConfirmation: () => {
      if (inFlightRef.current) return;
      setPendingIntent(null);
      setMutationState("IDLE");
    },
    retryExactMutation,
    clearMutation,
  };
}

function visibleResource<T>(
  resource: OwnedResource<T>,
  ownerId: string | null,
  allowed: boolean,
  isAuthLoading: boolean,
): ResourceView<T> {
  if (isAuthLoading) {
    return {
      data: null,
      state: "LOADING",
      error: null,
      correlationId: null,
      timestamp: null,
      isRefreshing: false,
    };
  }
  if (!allowed) {
    return {
      data: null,
      state: "FORBIDDEN",
      error: null,
      correlationId: null,
      timestamp: null,
      isRefreshing: false,
    };
  }
  if (!ownerId || resource.ownerId !== ownerId) {
    return {
      data: null,
      state: "LOADING",
      error: null,
      correlationId: null,
      timestamp: null,
      isRefreshing: false,
    };
  }
  return resource;
}

function classifyReadFailure(
  original: unknown,
  error: NormalizedApiError,
): ResourceState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (
    original instanceof TypeError ||
    [502, 503, 504].includes(error.httpStatus) ||
    /(?:UPSTREAM|UNAVAILABLE|TIMEOUT)/u.test(error.errorCode)
  ) {
    return "UNAVAILABLE";
  }
  return "ERROR";
}

function classifyMutationFailure(error: NormalizedApiError): MutationState {
  if (error.httpStatus === 403) return "FORBIDDEN";
  if (error.httpStatus === 400 || error.httpStatus === 422) return "VALIDATION";
  if (error.httpStatus === 409) return "CONFLICT";
  return "ERROR";
}

function retainAmbiguousIntent(
  original: unknown,
  error: NormalizedApiError,
): boolean {
  return (
    getApiRequestOutcome(original) === "settled-before-session-change" ||
    error.httpStatus >= 500 ||
    error.errorCode === "GW.IDEM.IN_FLIGHT" ||
    error.errorCode === "UNKNOWN_ERROR" ||
    /(?:UPSTREAM|UNAVAILABLE|TIMEOUT)/u.test(error.errorCode)
  );
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== "undefined" &&
      error instanceof DOMException &&
      error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

export type PublisherKeysView = ReturnType<typeof usePublisherKeys>;
