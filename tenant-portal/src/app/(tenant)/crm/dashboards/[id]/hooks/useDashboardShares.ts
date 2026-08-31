"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { DASHBOARD_SHARE_TARGETS_PATH, dashboardPath } from "../../dashboard-contract";
import {
  buildShareRequest,
  parseShareTargetsResponse,
  parseSharesResponse,
  resourceSharePath,
  resourceSharesPath,
  shareTargetsQuery,
  type ShareAccessLevel,
  type ShareRecord,
  type ShareSubjectType,
  type ShareTarget,
} from "../../share-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 512 * 1024 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 128 * 1024,
  nonReplayable: true,
} as const;

export interface ShareWriteResult {
  ok: boolean;
  error: NormalizedApiError | null;
}

/**
 * Every share route on both controllers asserts **ownership**, not the share
 * permission alone: `DashboardSharesService.assertOwner` demands `OWNER`. A
 * user holding `crm.dashboards.share` on a dashboard shared *with* them still
 * gets `403 CRM_DASHBOARD_DEFINITION_ACCESS_DENIED`, so the panel is only
 * mounted for an owner.
 */
export function useDashboardShares(dashboardId: string, enabled: boolean) {
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const resourcePath = dashboardPath(dashboardId);

  const load = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await axiosClient.get<unknown>(
        resourceSharesPath(resourcePath),
        READ_CONFIG,
      );
      setShares(parseSharesResponse(response.data));
    } catch (caught) {
      setError(normalizeApiError(caught));
    } finally {
      setIsLoading(false);
    }
  }, [enabled, resourcePath]);

  // Deferred out of the effect body: a synchronous setState there cascades a
  // render, which `react-hooks/set-state-in-effect` refuses. Same shape as
  // every other loader in this app.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void load();
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const searchTargets = async (search: string): Promise<void> => {
    if (!enabled) return;
    try {
      const response = await axiosClient.get<unknown>(
        `${DASHBOARD_SHARE_TARGETS_PATH}${shareTargetsQuery(search, 0)}`,
        READ_CONFIG,
      );
      setTargets(parseShareTargetsResponse(response.data).items);
    } catch {
      // A failed target search leaves the picker empty rather than failing the
      // panel: the existing shares are a separate, already-loaded source.
      setTargets([]);
    }
  };

  const share = async (input: {
    subjectType: ShareSubjectType;
    subjectId: string;
    accessLevel: ShareAccessLevel;
    expiresAt: string;
  }): Promise<ShareWriteResult> => {
    setIsSubmitting(true);
    try {
      await axiosClient.post<unknown>(
        resourceSharesPath(resourcePath),
        buildShareRequest(input),
        WRITE_CONFIG,
      );
      await load();
      return { ok: true, error: null };
    } catch (caught) {
      return {
        ok: false,
        error:
          caught instanceof Error && caught.message.startsWith("CRM_")
            ? { status: 0, code: caught.message }
            : normalizeApiError(caught),
      };
    } finally {
      setIsSubmitting(false);
    }
  };

  const revoke = async (shareId: string): Promise<ShareWriteResult> => {
    setIsSubmitting(true);
    try {
      await axiosClient.delete<unknown>(
        resourceSharePath(resourcePath, shareId),
        WRITE_CONFIG,
      );
      await load();
      return { ok: true, error: null };
    } catch (caught) {
      return { ok: false, error: normalizeApiError(caught) };
    } finally {
      setIsSubmitting(false);
    }
  };

  return { shares, targets, isLoading, isSubmitting, error, searchTargets, share, revoke, reload: load };
}
