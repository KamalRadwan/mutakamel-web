"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useTenantAuth } from "@/context/AuthContext";
import { useToast } from "@/design-system";
import { formatApiErrorMessage } from "@/design-system/feedback/format-api-error";
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
import { InvalidRecoveryRestoreReply } from "../../template-wire";

const noReadyProfile = () => null;

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
  const { user, authState, realtimeAuthGeneration, readReadyProfileCommit, subscribeProfileReadiness } = useTenantAuth();
  const profile = useSyncExternalStore(subscribeProfileReadiness, readReadyProfileCommit, noReadyProfile);
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
  const [selection, setSelection] = useState<{ snapshot: TemplateRecoverySnapshot } | null>(null);
  const restoring = selection?.snapshot ?? null;
  const activeSelection = useRef<typeof selection>(null);
  const selectSnapshot = useCallback((snapshot: TemplateRecoverySnapshot | null) => {
    const next = snapshot ? { snapshot } : null;
    activeSelection.current = next;
    setSelection(next);
  }, []);
  const [acknowledgedDiscard, setAcknowledgedDiscard] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [expiryObservedAt, setExpiryObservedAt] = useState(Date.now);

  const templateId = template?.id ?? null;
  const draft = template?.currentDraft;
  const scope = template?.scope;
  const restoreKey = JSON.stringify([templateId, template?.definitionRevision, template?.lifecycleStatus,
    scope?.type, scope?.companyId, scope?.branchId, draft?.draftId, draft?.revision, draft?.etag,
    draft?.contentChecksum, user?.id, authState, realtimeAuthGeneration, canRestore]);
  const restoreAuthority = useMemo(() => ({ restoreKey, profile }), [restoreKey, profile]);
  const activeRestoreAuthority = useRef<typeof restoreAuthority | null>(null);
  const restoreInFlight = useRef(false);
  const isRestoreCurrent = useCallback(() =>
    activeRestoreAuthority.current === restoreAuthority && readReadyProfileCommit() === profile,
  [restoreAuthority, readReadyProfileCommit, profile]);
  useLayoutEffect(() => {
    activeRestoreAuthority.current = restoreAuthority;
    selectSnapshot(null);
    setAcknowledgedDiscard(false);
    setFormError(null);
    setIsSubmitting(false);
    return () => {
      activeRestoreAuthority.current = null;
      activeSelection.current = null;
      restoreInFlight.current = false;
    };
  }, [restoreAuthority, selectSnapshot]);

  if (history.templateId !== templateId) {
    restart(false);
    setHistory({ templateId, page: null });
    setIsLoading(true);
    setError(null);
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
          if (!controller.signal.aborted) {
            setExpiryObservedAt(Date.now());
            setHistory((current) => ({ ...current, page }));
          }
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

  useEffect(() => {
    if (!canRestore) return;
    let nextExpiry = Infinity;
    const snapshots = history.page?.items ?? [];
    for (const snapshot of restoring ? [...snapshots, restoring] : snapshots) {
      const expiry = snapshotExpiryTime(snapshot.expiresAt);
      if (expiry > expiryObservedAt) nextExpiry = Math.min(nextExpiry, expiry);
    }
    if (!Number.isFinite(nextExpiry)) return;
    const delay = Math.max(0, nextExpiry - Date.now());
    const timer = setTimeout(() => setExpiryObservedAt(Date.now()), Math.min(delay, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [canRestore, history.page, restoring, expiryObservedAt]);

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
      if (!template || !selection || activeSelection.current !== selection ||
        !canRestore || restoreInFlight.current || !isRestoreCurrent()) return;
      const { snapshot } = selection;
      const now = Date.now();
      const expiryError = snapshotExpiryError(snapshot.expiresAt, now, copy);
      if (expiryError) {
        setExpiryObservedAt(now);
        setFormError(expiryError);
        return;
      }
      if (!acknowledgedDiscard) {
        setFormError(copy.discardAcknowledgementRequired);
        return;
      }
      if (reason.trim().length === 0) {
        setFormError(copy.reasonRequired);
        return;
      }
      restoreInFlight.current = true;
      setIsSubmitting(true);
      setFormError(null);
      try {
        await restoreRecoverySnapshot(
          template.id,
          snapshot.id,
          {
            expectedSnapshotChecksum: snapshot.snapshotChecksum,
            reason: reason.trim(),
            discardCurrentDraft: true,
          },
          {
            draftId: template.currentDraft.draftId,
            revision: template.currentDraft.revision,
            etag: template.currentDraft.etag,
            assertCurrent() {
              if (!isRestoreCurrent()) throw new DOMException("Snapshot restore authority changed.", "AbortError");
            },
          },
        );
        if (!isRestoreCurrent()) return;
        toast.success(copy.savedTitle, copy.snapshotRestored);
        selectSnapshot(null);
        setAcknowledgedDiscard(false);
        setReloadToken((token) => token + 1);
        onReload();
      } catch (caught) {
        if (!isRestoreCurrent()) return;
        if (caught instanceof InvalidRecoveryRestoreReply) {
          setFormError(formatApiErrorMessage({
            status: 0, message: copy.invalidLifecycleReply, correlationId: caught.correlationId,
          }, t) ?? copy.snapshotRestoreFailed);
          return;
        }
        const normalized = normalizeApiError(caught);
        if (normalized.status === 403) return;
        if (toast.outcomeFromApi(normalized)) return;
        setFormError(snapshotMessage(normalized.code, copy) ?? copy.snapshotRestoreFailed);
      } finally {
        if (isRestoreCurrent()) {
          restoreInFlight.current = false;
          setIsSubmitting(false);
        }
      }
    },
    [template, selection, canRestore, isRestoreCurrent, acknowledgedDiscard, selectSnapshot, toast, copy, onReload, t],
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
    snapshotExpiry: (snapshot: TemplateRecoverySnapshot) => snapshotExpiryState(snapshot.expiresAt, expiryObservedAt),
    restoringExpiryError: restoring ? snapshotExpiryError(restoring.expiresAt, expiryObservedAt, copy) : null,
    setAcknowledgedDiscard: (checked: boolean) => { if (isRestoreCurrent()) setAcknowledgedDiscard(checked); },
    // The acknowledgement is given before the row's action unlocks, so opening
    // the reason dialog must not clear it.
    openRestore: (snapshot: TemplateRecoverySnapshot) => {
      if (!canRestore || !isRestoreCurrent() || restoreInFlight.current) return;
      const now = Date.now();
      if (snapshotExpiryState(snapshot.expiresAt, now) !== "current") {
        setExpiryObservedAt(now);
        return;
      }
      setFormError(null);
      selectSnapshot(snapshot);
    },
    closeRestore: () => {
      if (!selection || activeSelection.current !== selection ||
        !isRestoreCurrent() || restoreInFlight.current) return;
      selectSnapshot(null);
    },
    restore,
    reload: () => setReloadToken((token) => token + 1),
  };
}

type TemplatesCopy = ReturnType<typeof useI18n>["t"]["coreOperations"]["templates"];

function snapshotExpiryTime(value: unknown): number {
  return typeof value === "string" ? Date.parse(value) : NaN;
}

function snapshotExpiryState(value: unknown, now: number): "current" | "expired" | "invalid" {
  const expiry = snapshotExpiryTime(value);
  if (!Number.isFinite(expiry)) return "invalid";
  return expiry <= now ? "expired" : "current";
}

function snapshotExpiryError(value: unknown, now: number, copy: TemplatesCopy): string | null {
  const state = snapshotExpiryState(value, now);
  if (state === "expired") return copy.snapshotExpired;
  return state === "invalid" ? copy.recoveryLoadFailed : null;
}

function snapshotMessage(code: string | undefined, copy: TemplatesCopy): string | undefined {
  if (code === SNAPSHOT_EXPIRED_CODE) return copy.snapshotExpired;
  if (code === SNAPSHOT_STALE_CODE) return copy.snapshotStale;
  if (code === SNAPSHOT_ALREADY_RESTORED_CODE) return copy.snapshotAlreadyRestored;
  if (code === SNAPSHOT_INTEGRITY_CODE) return copy.snapshotIntegrityFailed;
  return undefined;
}
