"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  // Defect D9. Neither read was ordered or cancelled, so moving from one
  // dashboard to another could leave the first dashboard's grants rendered
  // under the second — a share list is exactly the wrong thing to show for the
  // wrong resource. One epoch per source; a response that is no longer the one
  // being waited for is discarded rather than committed.
  const sharesEpochRef = useRef(0);
  const sharesRequestRef = useRef<AbortController | null>(null);
  const targetsEpochRef = useRef(0);
  const targetsRequestRef = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      sharesRequestRef.current?.abort();
      targetsRequestRef.current?.abort();
    },
    [],
  );

  const load = useCallback(async (): Promise<void> => {
    const epoch = sharesEpochRef.current + 1;
    sharesEpochRef.current = epoch;
    sharesRequestRef.current?.abort();
    if (!enabled) {
      sharesRequestRef.current = null;
      return;
    }
    const controller = new AbortController();
    sharesRequestRef.current = controller;
    setIsLoading(true);
    setError(null);
    try {
      const response = await axiosClient.get<unknown>(
        resourceSharesPath(resourcePath),
        { ...READ_CONFIG, signal: controller.signal },
      );
      const parsed = parseSharesResponse(response.data);
      if (epoch !== sharesEpochRef.current) return;
      setShares(parsed);
    } catch (caught) {
      if (isAbortError(caught) || epoch !== sharesEpochRef.current) return;
      setError(normalizeApiError(caught));
    } finally {
      if (epoch === sharesEpochRef.current) {
        sharesRequestRef.current = null;
        setIsLoading(false);
      }
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
    const epoch = targetsEpochRef.current + 1;
    targetsEpochRef.current = epoch;
    targetsRequestRef.current?.abort();
    if (!enabled) {
      targetsRequestRef.current = null;
      return;
    }
    const controller = new AbortController();
    targetsRequestRef.current = controller;
    try {
      const response = await axiosClient.get<unknown>(
        `${DASHBOARD_SHARE_TARGETS_PATH}${shareTargetsQuery(search, 0)}`,
        { ...READ_CONFIG, signal: controller.signal },
      );
      const parsed = parseShareTargetsResponse(response.data).items;
      if (epoch !== targetsEpochRef.current) return;
      setTargets(parsed);
    } catch (caught) {
      // A failed target search leaves the picker empty rather than failing the
      // panel: the existing shares are a separate, already-loaded source. A
      // superseded one leaves it alone entirely.
      if (isAbortError(caught) || epoch !== targetsEpochRef.current) return;
      setTargets([]);
    } finally {
      if (epoch === targetsEpochRef.current) targetsRequestRef.current = null;
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

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
