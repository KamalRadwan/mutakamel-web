"use client";

import { useCallback, useEffect, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import {
  WIDGET_SHARE_TARGETS_PATH,
  widgetPath,
} from "../../../dashboards/widget-contract";
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
} from "../../../dashboards/share-contract";

const READ_CONFIG = { cache: "no-store", maxResponseBytes: 512 * 1024 } as const;
const WRITE_CONFIG = {
  cache: "no-store",
  maxResponseBytes: 128 * 1024,
  nonReplayable: true,
} as const;

/**
 * Widget shares.
 *
 * Same four routes as a dashboard's, on a different controller and behind a
 * different permission: `crm.widgets.share`, which is a static key, and — like
 * the dashboard's — ownership on top, because `assertOwner` demands `OWNER`.
 */
export function useWidgetShareGrants(widgetId: string, enabled: boolean) {
  const [shares, setShares] = useState<ShareRecord[]>([]);
  const [targets, setTargets] = useState<ShareTarget[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<NormalizedApiError | null>(null);

  const resourcePath = widgetPath(widgetId);

  const load = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await axiosClient.get<unknown>(resourceSharesPath(resourcePath), READ_CONFIG);
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

  return {
    shares,
    targets,
    isLoading,
    isSubmitting,
    error,
    searchTargets: async (search: string): Promise<void> => {
      if (!enabled) return;
      try {
        const response = await axiosClient.get<unknown>(
          `${WIDGET_SHARE_TARGETS_PATH}${shareTargetsQuery(search, 0)}`,
          READ_CONFIG,
        );
        setTargets(parseShareTargetsResponse(response.data).items);
      } catch {
        setTargets([]);
      }
    },
    share: async (input: {
      subjectType: ShareSubjectType;
      subjectId: string;
      accessLevel: ShareAccessLevel;
      expiresAt: string;
    }): Promise<NormalizedApiError | null> => {
      setIsSubmitting(true);
      try {
        await axiosClient.post<unknown>(
          resourceSharesPath(resourcePath),
          buildShareRequest(input),
          WRITE_CONFIG,
        );
        await load();
        return null;
      } catch (caught) {
        return caught instanceof Error && caught.message.startsWith("CRM_")
          ? { status: 0, code: caught.message }
          : normalizeApiError(caught);
      } finally {
        setIsSubmitting(false);
      }
    },
    revoke: async (shareId: string): Promise<NormalizedApiError | null> => {
      setIsSubmitting(true);
      try {
        await axiosClient.delete<unknown>(resourceSharePath(resourcePath, shareId), WRITE_CONFIG);
        await load();
        return null;
      } catch (caught) {
        return normalizeApiError(caught);
      } finally {
        setIsSubmitting(false);
      }
    },
  };
}
