"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { normalizeApiError, type NormalizedApiError } from "@/shared/api/normalized-api-error";
import { provisioningReleasesApi } from "../api/provisioning-releases-api";
import { classifyReleaseMutationError, classifyReleaseReadError } from "../model/release-errors";
import {
  createReleaseIntentStore,
  shouldRetainReleaseIntent,
  stableReleaseFingerprint,
} from "../model/release-intents";
import { readReleasePermissions } from "../model/release-permissions";
import { buildVerifiedSigningPayload } from "../model/release-signing";
import {
  buildPublishReleaseDraftDto,
  buildUpdateReleaseDraftDto,
  buildValidateReleaseDraftDto,
  definitionFromRelease,
  EMPTY_RELEASE_DEFINITION,
  validatePublishDraft,
  validatePublisherKeyId,
  validateReleaseDefinition,
} from "../model/release-validation";
import type {
  CoreSnapshot,
  ProvisioningRelease,
  PublishDraft,
  ReleaseDefinitionDraft,
  ReleaseDraft,
  ReleaseMutationName,
  ReleaseMutationState,
  ReleaseValidation,
  ReleaseValidationErrors,
  ResourceState,
} from "../types/provisioning-releases";

const EMPTY_MUTATION: ReleaseMutationState = {
  name: null,
  phase: "IDLE",
  error: null,
  correlationId: null,
};
const EMPTY_PUBLISH: PublishDraft = { signatureBase64: "", confirmed: false };

export type SigningEvidenceState =
  | { phase: "NONE" | "CHECKING" | "UNAVAILABLE" | "MISMATCH"; payloadBase64: null }
  | { phase: "VERIFIED"; payloadBase64: string };

export function useReleaseDraftDetail(draftId: string) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const permissions = useMemo(() => readReleasePermissions(user), [user]);
  const [state, setState] = useState<ResourceState>("LOADING");
  const [snapshot, setSnapshot] = useState<CoreSnapshot<ReleaseDraft> | null>(null);
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [revision, setRevision] = useState(0);
  const [definition, setDefinition] = useState<ReleaseDefinitionDraft>({
    ...EMPTY_RELEASE_DEFINITION,
  });
  const [definitionDirty, setDefinitionDirty] = useState(false);
  const [definitionErrors, setDefinitionErrors] = useState<ReleaseValidationErrors>({});
  const [publisherKeyId, setPublisherKeyIdState] = useState("");
  const [validationErrors, setValidationErrors] = useState<ReleaseValidationErrors>({});
  const [publishDraft, setPublishDraft] = useState<PublishDraft>({ ...EMPTY_PUBLISH });
  const [publishErrors, setPublishErrors] = useState<ReleaseValidationErrors>({});
  const [mutation, setMutation] = useState<ReleaseMutationState>(EMPTY_MUTATION);
  const [validation, setValidation] = useState<CoreSnapshot<ReleaseValidation> | null>(null);
  const [published, setPublished] = useState<CoreSnapshot<ProvisioningRelease> | null>(null);
  const [signingEvidence, setSigningEvidence] = useState<SigningEvidenceState>({
    phase: "NONE",
    payloadBase64: null,
  });
  const requestGeneration = useRef(0);
  const signingGeneration = useRef(0);
  const hasSnapshot = useRef(false);
  const definitionDirtyRef = useRef(false);
  const intents = useRef(createReleaseIntentStore());

  const applyDraft = useCallback((next: CoreSnapshot<ReleaseDraft>, preserveDefinition = false) => {
    hasSnapshot.current = true;
    setSnapshot(next);
    if (!preserveDefinition || !["DRAFT", "VALIDATED"].includes(next.data.status)) {
      definitionDirtyRef.current = false;
      setDefinitionDirty(false);
      setDefinition(definitionFromRelease(next.data));
    }
    setPublisherKeyIdState(next.data.publisherKeyId ?? "");
    setState("READY");
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      intents.current.clearAll();
      hasSnapshot.current = false;
      setSnapshot(null);
      setValidation(null);
      setPublished(null);
      setMutation(EMPTY_MUTATION);
      definitionDirtyRef.current = false;
      setDefinitionDirty(false);
      setDefinitionErrors({});
      setValidationErrors({});
      setPublishErrors({});
      setPublishDraft({ ...EMPTY_PUBLISH });
    });
    return () => {
      cancelled = true;
    };
  }, [draftId]);

  useEffect(() => {
    if (isAuthLoading || !permissions.canRead) return;
    const current = ++requestGeneration.current;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted || current !== requestGeneration.current) return;
      if (hasSnapshot.current) setIsRefreshing(true);
      else setState("LOADING");
      setError(null);
    });
    void provisioningReleasesApi
      .getDraft(draftId, controller.signal)
      .then((next) => {
        if (controller.signal.aborted || current !== requestGeneration.current) return;
        applyDraft(next, definitionDirtyRef.current);
      })
      .catch((caught) => {
        if (controller.signal.aborted || current !== requestGeneration.current || isAbortError(caught)) return;
        const normalized = normalizeApiError(caught);
        hasSnapshot.current = false;
        setSnapshot(null);
        setError(normalized);
        setState(classifyReleaseReadError(caught, normalized));
      })
      .finally(() => {
        if (!controller.signal.aborted && current === requestGeneration.current) setIsRefreshing(false);
      });
    return () => controller.abort();
  }, [applyDraft, draftId, isAuthLoading, permissions.canRead, revision]);

  useEffect(() => {
    const draft = snapshot?.data;
    const current = ++signingGeneration.current;
    if (draft?.status !== "VALIDATED" || !draft.signingDigest || !draft.publisherKeyId) {
      queueMicrotask(() => {
        if (current === signingGeneration.current) {
          setSigningEvidence({ phase: "NONE", payloadBase64: null });
        }
      });
      return;
    }
    const authoritativeValidation = validation?.data;
    if (
      authoritativeValidation?.draftId === draft.draftId &&
      authoritativeValidation.revision === draft.revision &&
      authoritativeValidation.signingDigest === draft.signingDigest
    ) {
      queueMicrotask(() => {
        if (current === signingGeneration.current) {
          setSigningEvidence({
            phase: "VERIFIED",
            payloadBase64: authoritativeValidation.payloadBase64,
          });
        }
      });
      return;
    }
    queueMicrotask(() => {
      if (current === signingGeneration.current) {
        setSigningEvidence({ phase: "CHECKING", payloadBase64: null });
      }
    });
    void buildVerifiedSigningPayload(draft)
      .then((evidence) => {
        if (current !== signingGeneration.current) return;
        setSigningEvidence(
          evidence.matchesCoreDigest
            ? { phase: "VERIFIED", payloadBase64: evidence.payloadBase64 }
            : { phase: "MISMATCH", payloadBase64: null },
        );
      })
      .catch(() => {
        if (current === signingGeneration.current) {
          setSigningEvidence({ phase: "UNAVAILABLE", payloadBase64: null });
        }
      });
  }, [snapshot, validation]);

  const updateDefinition = useCallback(
    <K extends keyof ReleaseDefinitionDraft>(field: K, value: ReleaseDefinitionDraft[K]) => {
      definitionDirtyRef.current = true;
      setDefinitionDirty(true);
      setDefinition((current) => ({ ...current, [field]: value }));
      setDefinitionErrors((current) => without(current, field));
      setMutation((current) => (current.phase === "PENDING" ? current : EMPTY_MUTATION));
    },
    [],
  );
  const setPublisherKeyId = useCallback((value: string) => {
    setPublisherKeyIdState(value);
    setValidationErrors((current) => without(current, "publisherKeyId"));
  }, []);
  const updatePublishDraft = useCallback(<K extends keyof PublishDraft>(field: K, value: PublishDraft[K]) => {
    setPublishDraft((current) => ({ ...current, [field]: value }));
    setPublishErrors((current) => without(current, field));
  }, []);

  const failMutation = useCallback((name: ReleaseMutationName, scope: string, caught: unknown) => {
    const normalized = normalizeApiError(caught);
    if (!shouldRetainReleaseIntent(normalized)) intents.current.clear(scope);
    const phase = classifyReleaseMutationError(caught, normalized);
    setMutation({
      name,
      phase,
      error: normalized,
      correlationId: normalized.correlationId ?? null,
    });
    if (["CONFLICT", "IN_FLIGHT", "UNAVAILABLE"].includes(phase)) {
      setRevision((current) => current + 1);
    }
  }, []);

  const saveDraft = useCallback(async () => {
    const draft = snapshot?.data;
    if (
      !draft ||
      !permissions.canManageDrafts ||
      !["DRAFT", "VALIDATED"].includes(draft.status) ||
      mutation.phase === "PENDING"
    ) {
      return null;
    }
    const errors = validateReleaseDefinition(definition);
    setDefinitionErrors(errors);
    if (Object.keys(errors).length) return null;
    const dto = buildUpdateReleaseDraftDto(definition, draft.revision);
    const scope = `release-draft:update:${draft.draftId}`;
    const key = intents.current.get(scope, stableReleaseFingerprint(dto));
    setMutation({ name: "UPDATE", phase: "PENDING", error: null, correlationId: null });
    try {
      const result = await provisioningReleasesApi.updateDraft(draft.draftId, dto, key);
      intents.current.clear(scope);
      requestGeneration.current += 1;
      setValidation(null);
      applyDraft(result);
      setMutation({ name: "UPDATE", phase: "SUCCEEDED", error: null, correlationId: result.correlationId });
      return result;
    } catch (caught) {
      failMutation("UPDATE", scope, caught);
      return null;
    }
  }, [applyDraft, definition, failMutation, mutation.phase, permissions.canManageDrafts, snapshot]);

  const validateDraft = useCallback(async () => {
    const draft = snapshot?.data;
    if (
      !draft ||
      !permissions.canManageDrafts ||
      draft.status !== "DRAFT" ||
      definitionDirty ||
      mutation.phase === "PENDING"
    ) {
      return null;
    }
    const errors = validatePublisherKeyId(publisherKeyId);
    setValidationErrors(errors);
    if (Object.keys(errors).length) return null;
    const dto = buildValidateReleaseDraftDto(draft, publisherKeyId);
    const scope = `release-draft:validate:${draft.draftId}`;
    const key = intents.current.get(scope, stableReleaseFingerprint(dto));
    setMutation({ name: "VALIDATE", phase: "PENDING", error: null, correlationId: null });
    try {
      const result = await provisioningReleasesApi.validateDraft(draft.draftId, dto, key);
      intents.current.clear(scope);
      setValidation(result);
      requestGeneration.current += 1;
      setMutation({ name: "VALIDATE", phase: "SUCCEEDED", error: null, correlationId: result.correlationId });
      try {
        const refreshed = await provisioningReleasesApi.getDraft(draft.draftId);
        applyDraft(refreshed);
      } catch {
        // The validation command is already authoritative and replay-safe.
        // A failed reconciliation read must not be misreported as a failed
        // command; retry the independent GET instead.
        setRevision((current) => current + 1);
      }
      return result;
    } catch (caught) {
      failMutation("VALIDATE", scope, caught);
      return null;
    }
  }, [
    applyDraft,
    definitionDirty,
    failMutation,
    mutation.phase,
    permissions.canManageDrafts,
    publisherKeyId,
    snapshot,
  ]);

  const publish = useCallback(async () => {
    const draft = snapshot?.data;
    if (
      !draft ||
      !permissions.canPublishCritical ||
      draft.status !== "VALIDATED" ||
      signingEvidence.phase !== "VERIFIED" ||
      definitionDirty ||
      mutation.phase === "PENDING" ||
      published !== null
    ) {
      return null;
    }
    const errors = validatePublishDraft(publishDraft);
    setPublishErrors(errors);
    if (Object.keys(errors).length) return null;
    const dto = buildPublishReleaseDraftDto(draft, publishDraft);
    const scope = `release-draft:publish:${draft.draftId}`;
    const key = intents.current.get(scope, stableReleaseFingerprint(dto));
    setMutation({ name: "PUBLISH", phase: "PENDING", error: null, correlationId: null });
    try {
      const result = await provisioningReleasesApi.publishDraft(draft.draftId, dto, key);
      intents.current.clear(scope);
      requestGeneration.current += 1;
      setPublished(result);
      setRevision((current) => current + 1);
      setMutation({ name: "PUBLISH", phase: "SUCCEEDED", error: null, correlationId: result.correlationId });
      return result;
    } catch (caught) {
      failMutation("PUBLISH", scope, caught);
      return null;
    }
  }, [
    definitionDirty,
    failMutation,
    mutation.phase,
    permissions.canPublishCritical,
    publishDraft,
    published,
    signingEvidence.phase,
    snapshot,
  ]);

  const visibleState: ResourceState = isAuthLoading
    ? "LOADING"
    : !permissions.canRead
      ? "FORBIDDEN"
      : state;
  const draft = snapshot?.data ?? null;
  return {
    permissions,
    state: visibleState,
    snapshot: visibleState === "READY" ? snapshot : null,
    error,
    isRefreshing,
    definition,
    definitionDirty,
    definitionErrors,
    publisherKeyId,
    validationErrors,
    publishDraft,
    publishErrors,
    mutation,
    validation,
    published,
    signingEvidence,
    canEdit: Boolean(
      permissions.canManageDrafts && draft && ["DRAFT", "VALIDATED"].includes(draft.status),
    ),
    canValidate: Boolean(
      permissions.canManageDrafts && draft?.status === "DRAFT" && !definitionDirty,
    ),
    canPublish: Boolean(
      permissions.canPublishCritical &&
        draft?.status === "VALIDATED" &&
        !definitionDirty &&
        published === null &&
        signingEvidence.phase === "VERIFIED",
    ),
    updateDefinition,
    setPublisherKeyId,
    updatePublishDraft,
    saveDraft,
    validateDraft,
    publish,
    refresh: () => setRevision((current) => current + 1),
  };
}

function without(errors: ReleaseValidationErrors, field: string | number | symbol) {
  if (!errors[String(field)]) return errors;
  const next = { ...errors };
  delete next[String(field)];
  return next;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && (error.name === "AbortError" || error.message === "AbortError");
}
