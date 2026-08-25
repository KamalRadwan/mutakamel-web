"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { provisioningReleasesApi } from "../api/provisioning-releases-api";
import { classifyReleaseMutationError } from "../model/release-errors";
import {
  createReleaseIntentStore,
  shouldRetainReleaseIntent,
  stableReleaseFingerprint,
} from "../model/release-intents";
import { readReleasePermissions } from "../model/release-permissions";
import {
  buildCreateReleaseDraftDto,
  EMPTY_RELEASE_DEFINITION,
  validateReleaseDefinition,
} from "../model/release-validation";
import type {
  CoreSnapshot,
  ReleaseDefinitionDraft,
  ReleaseDraft,
  ReleaseMutationState,
  ReleaseValidationErrors,
} from "../types/provisioning-releases";

const EMPTY_MUTATION: ReleaseMutationState = {
  name: null,
  phase: "IDLE",
  error: null,
  correlationId: null,
};

export function useCreateReleaseDraft() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const permissions = useMemo(() => readReleasePermissions(user), [user]);
  const [definition, setDefinition] = useState<ReleaseDefinitionDraft>({
    ...EMPTY_RELEASE_DEFINITION,
  });
  const [errors, setErrors] = useState<ReleaseValidationErrors>({});
  const [mutation, setMutation] = useState<ReleaseMutationState>(EMPTY_MUTATION);
  const [created, setCreated] = useState<CoreSnapshot<ReleaseDraft> | null>(null);
  const intents = useRef(createReleaseIntentStore());

  const update = useCallback(
    <K extends keyof ReleaseDefinitionDraft>(field: K, value: ReleaseDefinitionDraft[K]) => {
      setDefinition((current) => ({ ...current, [field]: value }));
      setErrors((current) => {
        if (!current[field]) return current;
        const next = { ...current };
        delete next[field];
        return next;
      });
      setMutation((current) => (current.phase === "PENDING" ? current : EMPTY_MUTATION));
    },
    [],
  );

  const submit = useCallback(async () => {
    if (!permissions.canManageDrafts || mutation.phase === "PENDING") return null;
    const nextErrors = validateReleaseDefinition(definition);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return null;
    const dto = buildCreateReleaseDraftDto(definition);
    const scope = "release-draft:create";
    const key = intents.current.get(scope, stableReleaseFingerprint(dto));
    setMutation({ name: "CREATE", phase: "PENDING", error: null, correlationId: null });
    try {
      const result = await provisioningReleasesApi.createDraft(dto, key);
      intents.current.clear(scope);
      setCreated(result);
      setMutation({
        name: "CREATE",
        phase: "SUCCEEDED",
        error: null,
        correlationId: result.correlationId,
      });
      return result;
    } catch (caught) {
      const error = normalizeApiError(caught);
      if (!shouldRetainReleaseIntent(error)) intents.current.clear(scope);
      setMutation({
        name: "CREATE",
        phase: classifyReleaseMutationError(caught, error),
        error,
        correlationId: error.correlationId ?? null,
      });
      return null;
    }
  }, [definition, mutation.phase, permissions.canManageDrafts]);

  return {
    permissions,
    isAuthLoading,
    definition,
    errors,
    mutation,
    created,
    update,
    submit,
  };
}
