"use client";

import { useCallback, useEffect, useState } from "react";
import { useToast } from "@/design-system";
import { useI18n } from "@/i18n/I18nContext";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { fetchRecoverySnapshots, restoreRecoverySnapshot } from "../../template-lifecycle-api";
import {
  SNAPSHOT_ALREADY_RESTORED_CODE,
  SNAPSHOT_EXPIRED_CODE,
  SNAPSHOT_INTEGRITY_CODE,
  SNAPSHOT_STALE_CODE,
  type TemplateRecoverySnapshot,
} from "../../template-lifecycle-contract";
import type { TemplateCursorPage, TemplateDetail } from "../../templates-contract";
import { isExpiredCursor, useTemplateCursor } from "../../hooks/useTemplateCursor";

/**
 * Draft recovery snapshots.
 *
 * Restoring one requires **three** things the UI has to collect, none of which
 * may be defaulted: the snapshot's own checksum (it is checksum-pinned), an
 * operator **reason**, and an explicit acknowledgement that the current draft
 * is discarded — `discardCurrentDraft` is `@IsIn([true])`, so there is no
 * "keep both" outcome to offer.
 */
export function useTemplateRecovery(
  template: TemplateDetail | null,
  canRestore: boolean,
  onReload: () => void,
) {
  const { t } = useI18n();
  const toast = useToast();
  const copy = t.coreOperations.templates;
  const pagination = useTemplateCursor();
  const { cursor, restart } = pagination;

  const [history, setHistory] = useState<{
    templateId: string | null;
    page: TemplateCursorPage<TemplateRecoverySnapshot> | null;
  }>({ templateId: template?.id ?? null, page: null });
  const [isLoading, setIsLoading] = useState(true);
  // A screen that may not restore never asks, so it is never "loading" either.
  const [error, setError] = useState<NormalizedApiError | null>(null);
  const [restoring, setRestoring] = useState<TemplateRecoverySnapshot | null>(null);
  const [acknowledgedDiscard, setAcknowledgedDiscard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const templateId = template?.id ?? null;

  if (history.templateId !== templateId) {
    restart(false);
    setHistory({ templateId, page: null });
    setIsLoading(true);
    setError(null);
    setRestoring(null);
    setAcknowledgedDiscard(false);
    setFormError(null);
  }

  useEffect(() => {
    if (!templateId || !canRestore) return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      void (async () => {
        setIsLoading(true);
        setError(null);
        try {
          const page = await fetchRecoverySnapshots(templateId, { cursor, signal: controller.signal });
          if (!controller.signal.aborted) setHistory((current) => ({ ...current, page }));
        } catch (caught) {
          if (controller.signal.aborted) return;
          const normalized = normalizeApiError(caught);
          if (cursor && isExpiredCursor(normalized)) restart(true);
          else setError(normalized);
        } finally {
          if (!controller.signal.aborted) setIsLoading(false);
        }
      })();
    });
    return () => controller.abort();
  }, [templateId, canRestore, cursor, restart, reloadToken]);

  const changeSnapshotPage = (direction: "previous" | "next") => {
    if (!canRestore || isLoading || isSubmitting) return;
    const nextCursor = history.page?.hasNextPage ? history.page.nextCursor : null;
    if (direction === "next" ? !nextCursor : !pagination.canGoBack) return;
    if (direction === "next") pagination.advance(nextCursor);
    else pagination.goBack();
    setHistory({ ...history, page: null });
    setIsLoading(true);
    setError(null);
  };

  const restore = useCallback(
    async (reason: string): Promise<void> => {
      if (!template || !restoring || !canRestore || isSubmitting) return;
      if (!acknowledgedDiscard) {
        setFormError(copy.discardAcknowledgementRequired);
        return;
      }
      if (reason.trim().length === 0) {
        setFormError(copy.reasonRequired);
        return;
      }
      setIsSubmitting(true);
      setFormError(null);
      try {
        await restoreRecoverySnapshot(
          template.id,
          restoring.id,
          {
            expectedSnapshotChecksum: restoring.snapshotChecksum,
            reason: reason.trim(),
            discardCurrentDraft: true,
          },
          template.currentDraft.etag,
        );
        toast.success(copy.savedTitle, copy.snapshotRestored);
        setRestoring(null);
        setAcknowledgedDiscard(false);
        setReloadToken((token) => token + 1);
        onReload();
      } catch (caught) {
        const normalized = normalizeApiError(caught);
        if (normalized.status === 403) return;
        if (toast.outcomeFromApi(normalized)) return;
        setFormError(snapshotMessage(normalized.code, copy) ?? copy.snapshotRestoreFailed);
      } finally {
        setIsSubmitting(false);
      }
    },
    [template, restoring, canRestore, isSubmitting, acknowledgedDiscard, toast, copy, onReload],
  );

  return {
    snapshots: history.page?.items ?? [],
    hasPreviousSnapshotPage: pagination.canGoBack,
    hasNextSnapshotPage: Boolean(history.page?.hasNextPage && history.page.nextCursor),
    snapshotCursorWasReset: pagination.wasReset,
    previousSnapshotPage: () => changeSnapshotPage("previous"),
    nextSnapshotPage: () => changeSnapshotPage("next"),
    isLoading: isLoading && canRestore && template !== null,
    error,
    restoring,
    acknowledgedDiscard,
    isSubmitting,
    formError,
    setAcknowledgedDiscard,
    // The acknowledgement is given before the row's action unlocks, so opening
    // the reason dialog must not clear it.
    openRestore: (snapshot: TemplateRecoverySnapshot) => {
      setFormError(null);
      setRestoring(snapshot);
    },
    closeRestore: () => {
      if (isSubmitting) return;
      setRestoring(null);
    },
    restore,
    reload: () => setReloadToken((token) => token + 1),
  };
}

type TemplatesCopy = ReturnType<typeof useI18n>["t"]["coreOperations"]["templates"];

function snapshotMessage(code: string | undefined, copy: TemplatesCopy): string | undefined {
  if (code === SNAPSHOT_EXPIRED_CODE) return copy.snapshotExpired;
  if (code === SNAPSHOT_STALE_CODE) return copy.snapshotStale;
  if (code === SNAPSHOT_ALREADY_RESTORED_CODE) return copy.snapshotAlreadyRestored;
  if (code === SNAPSHOT_INTEGRITY_CODE) return copy.snapshotIntegrityFailed;
  return undefined;
}
