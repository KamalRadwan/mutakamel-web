"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import type { CrmRecordSourceType } from "@/hooks/useCrmRecordOptions";
import { SCOPE_UNRESOLVED_ERROR, useOrganizationScopeHeaders } from "@/hooks/useOrganizationScope";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import { CRM_LEAD_CAPABILITIES_MAX_RESPONSE_BYTES } from "../../shared/crm-capabilities";
import { CUSTOM_FIELD_OWNER_RESOURCES, parseCustomFieldOwnerAccess } from "../custom-field-owner-access-contract";

interface OwnerAccessInput {
  ownerType: CrmRecordSourceType;
  branchId: string | null;
  ownerId: string | undefined;
  enabled: boolean;
}

export function useCustomFieldOwnerAccess({ ownerType, branchId, ownerId, enabled }: OwnerAccessInput) {
  const { user, authState, realtimeAuthGeneration } = useTenantAuth();
  const scope = useOrganizationScopeHeaders("BRANCH_REQUIRED", branchId);
  const [revision, setRevision] = useState(0);
  // Scope headers can stay identical after sign-in or a permission refresh.
  const request = useMemo(() => ({ ownerType, branchId, ownerId, enabled, revision, scope,
    user, authState, realtimeAuthGeneration }),
  [ownerType, branchId, ownerId, enabled, revision, scope, user, authState, realtimeAuthGeneration]);
  const authenticated = authState === "AUTHENTICATED" && isUUIDv7(user?.id);
  const selected = enabled && authenticated && isUUIDv7(branchId) && isUUIDv7(ownerId);
  const [loaded, setLoaded] = useState<{
    request: typeof request;
    canEdit: boolean;
    converted: boolean;
    error: NormalizedApiError | null;
  } | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    const epoch = ++generation.current;
    const controller = new AbortController();
    const current = () => !controller.signal.aborted && generation.current === epoch;
    if (enabled && authenticated && isUUIDv7(branchId) && isUUIDv7(ownerId) && scope.ready) {
      const headers = scope.headers;
      const requestBranchId = branchId;
      const requestOwnerId = ownerId;
      const resource = CUSTOM_FIELD_OWNER_RESOURCES[ownerType];
      const query = new URLSearchParams({ branchId: requestBranchId });
      queueMicrotask(async () => {
        if (!current()) return;
        try {
          const [capabilities, owner] = await Promise.all([
            axiosClient.get<unknown>(`${resource.path}/capabilities?${query}`, {
              signal: controller.signal, cache: "no-store", headers,
              maxResponseBytes: CRM_LEAD_CAPABILITIES_MAX_RESPONSE_BYTES,
            }),
            axiosClient.get<unknown>(`${resource.path}/${encodeURIComponent(requestOwnerId)}`, {
              signal: controller.signal, cache: "no-store", headers, maxResponseBytes: 2 * 1024 * 1024,
            }),
          ]);
          if (!current()) return;
          const access = parseCustomFieldOwnerAccess(capabilities.data, owner.data, ownerType, requestBranchId, requestOwnerId);
          setLoaded({ request, ...access, error: null });
        } catch (caught) {
          if (!current()) return;
          setLoaded({ request, canEdit: false, converted: false, error: normalizeApiError(caught) });
        }
      });
    }
    return () => { controller.abort(); };
  }, [authenticated, branchId, enabled, ownerId, ownerType, request, scope]);

  // A render for a new selection must never inherit the previous owner's grant.
  const current = loaded?.request === request ? loaded : null;
  const ready = selected && scope.ready;
  const retry = useCallback(() => setRevision((value) => value + 1), []);
  return {
    canEdit: ready && (current?.canEdit ?? false),
    converted: ready && (current?.converted ?? false),
    isLoading: ready && !current,
    error: selected && !scope.ready ? SCOPE_UNRESOLVED_ERROR : selected ? current?.error ?? null : null,
    retry,
  };
}
