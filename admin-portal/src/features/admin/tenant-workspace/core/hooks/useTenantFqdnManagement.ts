"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  normalizeApiError,
  type NormalizedApiError,
} from "@/shared/api/normalized-api-error";
import { tenantCoreApi } from "../api/tenant-core.api";
import {
  createTenantIntentKeyStore,
  shouldRetainTenantIntentKey,
} from "../model/intent-keys";
import {
  canAttachAfterPreflight,
  canPromoteLegacyPrimary,
  replaceTenantFqdn,
} from "../model/readers";
import type {
  FqdnAvailabilityResult,
  TenantCorePermissions,
  TenantFqdnView,
  TenantFqdnMutationName,
  TenantMutationState,
  TenantView,
} from "../types";

export interface UseTenantFqdnManagementInput {
  tenantId: string;
  tenant: TenantView | null;
  permissions: Pick<
    TenantCorePermissions,
    "canRead" | "canValidateFqdn" | "canManageFqdns"
  >;
  replaceTenant: (tenant: TenantView) => void;
  refreshTenant: () => Promise<TenantView | null>;
}

export function useTenantFqdnManagement({
  tenantId,
  tenant,
  permissions,
  replaceTenant,
  refreshTenant,
}: UseTenantFqdnManagementInput) {
  const tenantIdRef = useRef(tenantId);
  const tenantIdentityGeneration = useRef(0);
  const preflightGeneration = useRef(0);
  const preflightAbort = useRef<AbortController | null>(null);
  const listGeneration = useRef(0);
  const listAbort = useRef<AbortController | null>(null);
  const intentKeys = useRef(createTenantIntentKeyStore());
  const [candidate, setCandidateState] = useState("");
  const [evidence, setEvidence] = useState<FqdnAvailabilityResult | null>(null);
  const [isPreflighting, setIsPreflighting] = useState(false);
  const [preflightError, setPreflightError] =
    useState<NormalizedApiError | null>(null);
  const [fqdns, setFqdns] = useState<TenantFqdnView[]>([]);
  const [isLoadingFqdns, setIsLoadingFqdns] = useState(false);
  const [listError, setListError] = useState<NormalizedApiError | null>(null);
  const [mutation, setMutation] = useState<
    TenantMutationState<TenantFqdnMutationName>
  >({ name: null, error: null });

  useEffect(() => {
    let timer: number | undefined;
    if (tenantIdRef.current !== tenantId) {
      tenantIdentityGeneration.current += 1;
      tenantIdRef.current = tenantId;
      preflightGeneration.current += 1;
      preflightAbort.current?.abort();
      listGeneration.current += 1;
      listAbort.current?.abort();
      intentKeys.current.clearAll();
      timer = window.setTimeout(() => {
        setCandidateState("");
        setEvidence(null);
        setIsPreflighting(false);
        setPreflightError(null);
        setFqdns([]);
        setIsLoadingFqdns(false);
        setListError(null);
        setMutation({ name: null, error: null });
      }, 0);
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      tenantIdentityGeneration.current += 1;
      preflightGeneration.current += 1;
      preflightAbort.current?.abort();
      listGeneration.current += 1;
      listAbort.current?.abort();
    };
  }, [tenantId]);

  const loadFqdns = useCallback(async () => {
    const generation = ++listGeneration.current;
    listAbort.current?.abort();
    if (!permissions.canRead) {
      setFqdns([]);
      setListError(
        localError(
          "TENANT_FQDN_LIST_FORBIDDEN",
          "You do not have permission to read tenant domains.",
          403,
        ),
      );
      setIsLoadingFqdns(false);
      return null;
    }
    const controller = new AbortController();
    listAbort.current = controller;
    setIsLoadingFqdns(true);
    setListError(null);
    try {
      const result = await tenantCoreApi.listFqdns(tenantId, controller.signal);
      if (
        generation !== listGeneration.current ||
        controller.signal.aborted ||
        tenantIdRef.current !== tenantId
      ) {
        return null;
      }
      setFqdns(result);
      return result;
    } catch (caught) {
      if (
        generation !== listGeneration.current ||
        controller.signal.aborted ||
        tenantIdRef.current !== tenantId
      ) {
        return null;
      }
      setFqdns([]);
      setListError(normalizeApiError(caught));
      return null;
    } finally {
      if (generation === listGeneration.current) setIsLoadingFqdns(false);
    }
  }, [permissions.canRead, tenantId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadFqdns(), 0);
    return () => window.clearTimeout(timer);
  }, [loadFqdns]);

  const setCandidate = useCallback((value: string) => {
    preflightGeneration.current += 1;
    preflightAbort.current?.abort();
    setCandidateState(value);
    setEvidence(null);
    setPreflightError(null);
  }, []);

  const preflight = useCallback(async () => {
    if (!permissions.canValidateFqdn) {
      throw localError(
        "TENANT_FQDN_PREFLIGHT_FORBIDDEN",
        "You do not have permission to validate domains.",
        403,
      );
    }
    const fqdn = normalizeCandidate(candidate);
    if (!fqdn) {
      const error = localError(
        "TENANT_FQDN_REQUIRED",
        "Enter a domain before validating it.",
        400,
      );
      setPreflightError(error);
      throw error;
    }

    const generation = ++preflightGeneration.current;
    preflightAbort.current?.abort();
    const controller = new AbortController();
    preflightAbort.current = controller;
    setIsPreflighting(true);
    setPreflightError(null);
    setEvidence(null);
    try {
      const result = await tenantCoreApi.validateFqdn(fqdn, controller.signal);
      if (
        generation !== preflightGeneration.current ||
        controller.signal.aborted ||
        tenantIdRef.current !== tenantId ||
        normalizeCandidate(candidate) !== fqdn
      ) {
        return null;
      }
      setEvidence(result);
      return result;
    } catch (caught) {
      if (
        generation !== preflightGeneration.current ||
        controller.signal.aborted ||
        tenantIdRef.current !== tenantId
      ) {
        return null;
      }
      const error = normalizeApiError(caught);
      setPreflightError(error);
      throw error;
    } finally {
      if (generation === preflightGeneration.current) {
        setIsPreflighting(false);
      }
    }
  }, [candidate, permissions.canValidateFqdn, tenantId]);

  const runWrite = useCallback(
    async <Result>(
      name: Exclude<TenantFqdnMutationName, "preflight">,
      intent: unknown,
      action: (idempotencyKey: string) => Promise<Result>,
    ) => {
      const identityGeneration = tenantIdentityGeneration.current;
      const key = intentKeys.current.get(name, intent);
      setMutation({ name, error: null });
      try {
        const result = await action(key);
        if (identityGeneration !== tenantIdentityGeneration.current) {
          throw localError(
            "TENANT_CONTEXT_CHANGED",
            "The selected tenant changed while the action was running.",
            409,
          );
        }
        intentKeys.current.clear(name);
        setMutation({ name: null, error: null });
        return result;
      } catch (caught) {
        const error = normalizeApiError(caught);
        if (identityGeneration === tenantIdentityGeneration.current) {
          if (!shouldRetainTenantIntentKey(error))
            intentKeys.current.clear(name);
          setMutation({ name: null, error });
        }
        throw error;
      }
    },
    [],
  );

  const assertManageableTenant = useCallback(() => {
    if (!permissions.canManageFqdns) {
      throw localError(
        "TENANT_FQDN_MANAGEMENT_FORBIDDEN",
        "You do not have permission to manage tenant domains.",
        403,
      );
    }
    if (!tenant || tenant.id !== tenantId || tenantIdRef.current !== tenantId) {
      throw localError(
        "TENANT_CONTEXT_CHANGED",
        "The selected tenant changed. Reload before continuing.",
        409,
      );
    }
    if (tenant.status !== "ACTIVE") {
      throw localError(
        "TENANT_FQDN_STATE_INVALID",
        "Domains can be changed only while the tenant is active.",
        409,
      );
    }
    return tenant;
  }, [permissions.canManageFqdns, tenant, tenantId]);

  const add = useCallback(async () => {
    const current = assertManageableTenant();
    const fqdn = normalizeCandidate(candidate);
    if (
      !evidence ||
      evidence.fqdn !== fqdn ||
      !canAttachAfterPreflight(evidence)
    ) {
      throw localError(
        "TENANT_FQDN_PREFLIGHT_REQUIRED",
        "Validate the current domain before attaching it.",
        409,
      );
    }
    const created = await runWrite(
      "add",
      { action: "tenant.fqdn.add", tenantId, fqdn },
      (key) => tenantCoreApi.addFqdn(tenantId, fqdn, key),
    );
    replaceTenant(replaceTenantFqdn(current, created));
    setFqdns((rows) => {
      const index = rows.findIndex((row) => row.id === created.id);
      if (index < 0) return [...rows, created];
      const next = [...rows];
      next[index] = created;
      return next;
    });
    setCandidateState("");
    setEvidence(null);
    return created;
  }, [
    assertManageableTenant,
    candidate,
    evidence,
    replaceTenant,
    runWrite,
    tenantId,
  ]);

  const remove = useCallback(
    async (fqdnId: string) => {
      const current = assertManageableTenant();
      const row = current.fqdns.find((item) => item.id === fqdnId);
      if (!row || row.isPrimary) {
        throw localError(
          "TENANT_FQDN_REMOVE_NOT_ALLOWED",
          "The primary domain cannot be removed.",
          409,
        );
      }
      await runWrite(
        "remove",
        { action: "tenant.fqdn.remove", tenantId, fqdnId },
        (key) => tenantCoreApi.removeFqdn(tenantId, fqdnId, key),
      );
      await Promise.all([refreshTenant(), loadFqdns()]);
    },
    [assertManageableTenant, loadFqdns, refreshTenant, runWrite, tenantId],
  );

  const promote = useCallback(
    async (fqdnId: string) => {
      const current = assertManageableTenant();
      const row = current.fqdns.find((item) => item.id === fqdnId);
      if (!row || !canPromoteLegacyPrimary(current, row)) {
        throw localError(
          "TENANT_FQDN_PROMOTION_NOT_ALLOWED",
          "Only a verified domain on a legacy tenant can become primary.",
          409,
        );
      }
      await runWrite(
        "promote",
        { action: "tenant.fqdn.promote", tenantId, fqdnId },
        (key) => tenantCoreApi.promoteFqdn(tenantId, fqdnId, key),
      );
      await Promise.all([refreshTenant(), loadFqdns()]);
    },
    [assertManageableTenant, loadFqdns, refreshTenant, runWrite, tenantId],
  );

  return {
    fqdns,
    isLoadingFqdns,
    listError,
    reloadFqdns: loadFqdns,
    candidate,
    setCandidate,
    evidence,
    isPreflighting,
    preflightError,
    mutation,
    canAdd: Boolean(
      tenant?.status === "ACTIVE" &&
      permissions.canManageFqdns &&
      evidence?.fqdn === normalizeCandidate(candidate) &&
      canAttachAfterPreflight(evidence),
    ),
    preflight,
    add,
    remove,
    promote,
  };
}

export type UseTenantFqdnManagementResult = ReturnType<
  typeof useTenantFqdnManagement
>;

function normalizeCandidate(value: string): string {
  return value.trim().toLowerCase();
}

function localError(
  errorCode: string,
  message: string,
  httpStatus: number,
): NormalizedApiError {
  return {
    isNormalized: true,
    httpStatus,
    errorCode,
    message,
  };
}
