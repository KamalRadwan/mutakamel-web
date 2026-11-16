"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError } from "@/lib/api/errors";
import { ACQUISITION_SOURCE_REORDER_PATH, applyAcquisitionSourceOrder, parseAcquisitionSourcesResponse, type AcquisitionSource } from "../acquisition-source-contract";
import { useAcquisitionSourceErrors } from "./useAcquisitionSourceErrors";

interface OrderingOptions {
  items: AcquisitionSource[];
  scope: string;
  canManage: boolean;
  blocked: boolean;
  apply: (items: AcquisitionSource[]) => void;
  reload: () => Promise<boolean>;
  setError: (message: string | null) => void;
  requireReload: () => void;
  forbidWrite: () => void;
}

export function useAcquisitionSourceOrdering(options: OrderingOptions) {
  const { t } = useI18n();
  const toast = useToast();
  const errorText = useAcquisitionSourceErrors();
  const [isReordering, setIsReordering] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(true);
  const live = useRef({ ...options, t, toast, errorText });
  useLayoutEffect(() => { live.current = { ...options, t, toast, errorText }; });
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function handleReorder(orderedIds: string[]): Promise<boolean> {
    const start = live.current;
    if (pending.current || !start.canManage || start.blocked) return false;
    const next = applyAcquisitionSourceOrder(start.items, orderedIds);
    if (!next) return false;
    if (start.items.every((source, index) => source.id === orderedIds[index])) return true;
    const current = () => mounted.current && live.current.scope === start.scope;
    pending.current = true;
    setIsReordering(true);
    start.setError(null);
    start.apply(next);
    try {
      const response = await axiosClient.patch<unknown>(ACQUISITION_SOURCE_REORDER_PATH, { orderedIds }, {
        cache: "no-store", maxResponseBytes: 1_000_000,
      });
      if (!current()) return false;
      const saved = parseAcquisitionSourcesResponse(response.data).sort((a, b) => a.sortOrder - b.sortOrder);
      if (saved.length !== orderedIds.length || saved.some((source, index) => source.id !== orderedIds[index] || source.sortOrder !== index + 1)) {
        throw new Error("INVALID_CRM_ACQUISITION_SOURCES_ORDER_RESPONSE");
      }
      start.apply(saved);
      live.current.toast.success(live.current.t.crmAcquisitionSources.orderSaved);
      return true;
    } catch (error) {
      if (!current()) return false;
      start.apply(start.items);
      start.requireReload();
      const failure = normalizeApiError(error);
      if (failure.status === 403) start.forbidWrite();
      const unknownOutcome = !failure.status || failure.status >= 500;
      const copy = live.current.t.crmAcquisitionSources;
      const message = unknownOutcome ? copy.reorderUncertain : live.current.errorText(failure) ?? copy.reorderFailed;
      start.setError(message);
      live.current.toast.warning(copy.reorderFailedTitle, message);
      // A local rollback cannot establish whether a timed-out write committed.
      await start.reload();
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setIsReordering(false);
    }
  }

  return { isReordering, handleReorder };
}
