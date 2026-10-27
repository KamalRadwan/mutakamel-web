"use client";

import { useEffect, useState } from "react";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import { tenantAccessApi } from "./api";
import type { TenantAccessController } from "./use-tenant-access";
import type { PageResult, TenantAccessResource, TenantUserView } from "./types";

type CandidateResource = TenantAccessResource<PageResult<TenantUserView>>;

export function useOwnershipTransferCandidates(
  controller: TenantAccessController,
  sourceOwnerId: string,
) {
  const { tenantId, enabled, ready, isAuthLoading, permissions } = controller;
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<{
    context: string;
    user: TenantUserView;
  } | null>(null);
  const [response, setResponse] = useState<{
    context: string;
    key: string;
    resource: CandidateResource;
  } | null>(null);
  const q = search.trim();
  const context = JSON.stringify([tenantId, sourceOwnerId]);
  const canLoad = enabled && ready && !isAuthLoading &&
    permissions.canRead && permissions.canTransferOwnership;
  const requestKey = JSON.stringify([context, q, page, revision, canLoad]);

  useEffect(() => {
    if (!canLoad) return;
    const abort = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const result = await tenantAccessApi.listUsers(tenantId, {
          page,
          limit: 20,
          ...(q ? { q } : {}),
          status: "ACTIVE",
          visibility: "ACTIVE",
          sortBy: "email",
          sortDir: "ASC",
        }, abort.signal);
        if (abort.signal.aborted) return;
        // The list API has no owner filter. Keep its page metadata so an
        // owner-only page never hides the controls for reaching the next page.
        const items = result.items.filter((candidate) =>
          candidate.id !== sourceOwnerId && !candidate.isTenantOwner &&
          candidate.deletedAt === null && candidate.status === "ACTIVE",
        );
        setResponse({
          context,
          key: requestKey,
          resource: {
            status: items.length ? "ready" : "empty",
            data: { ...result, items },
            error: null,
          },
        });
      } catch (caught) {
        if (abort.signal.aborted) return;
        const error = normalizeApiError(caught);
        setResponse({
          context,
          key: requestKey,
          resource: {
            status: error.httpStatus === 403 ? "forbidden" : "error",
            data: null,
            error,
          },
        });
      }
    }, q ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [canLoad, context, page, q, requestKey, sourceOwnerId, tenantId]);

  let resource: CandidateResource = {
    status: "loading",
    data: canLoad && response?.context === context ? response.resource.data : null,
    error: null,
  };
  if (!enabled) resource = { status: "idle", data: null, error: null };
  else if (!ready) resource = { status: "unavailable", data: null, error: null };
  else if (!isAuthLoading && (!permissions.canRead || !permissions.canTransferOwnership)) {
    resource = { status: "forbidden", data: null, error: null };
  } else if (canLoad && response?.key === requestKey) resource = response.resource;

  const selected = selection?.context === context ? selection.user : null;
  return {
    search,
    setSearch: (value: string) => {
      setSearch(value);
      setPage(1);
      setRevision((current) => current + 1);
    },
    page,
    setPage: (value: number) => {
      setPage(value);
      setRevision((current) => current + 1);
    },
    resource,
    selected,
    select: (id: string) => {
      if (selected?.id === id) return;
      const user = resource.data?.items.find((candidate) => candidate.id === id);
      setSelection(user ? { context, user } : null);
    },
    retry: () => setRevision((current) => current + 1),
  };
}
