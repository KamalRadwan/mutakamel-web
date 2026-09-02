"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { axiosClient } from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  CRM_NOTES_PATH,
  buildCreateCrmNoteRequest,
  buildCrmNotesListPath,
  buildUpdateCrmNoteRequest,
  crmNotePath,
  parseCrmNote,
  parseCrmNotesPageResponse,
  type CrmNote,
  type CrmNoteSourceType,
} from "../notes-contract";
import {
  createCrmWriteAttempt,
  expectNoContent,
  runCrmWrite,
  type CrmAppliedUnreadable,
  type CrmWriteAttempt,
} from "../crm-write";

const NOTES_PAGE_SIZE = 25;
const NOTES_RESPONSE_LIMIT_BYTES = 1024 * 1024;

export interface CrmNotesSource {
  branchId: string | null;
  sourceType: CrmNoteSourceType;
  sourceId: string | null;
}

export interface CrmNotesAmbiguity {
  operation: "create" | "update" | "delete";
  attempt: CrmWriteAttempt;
  error: NormalizedApiError;
  replay: () => Promise<void>;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

type SendWrite = () => Promise<
  | { kind: "success" }
  | { kind: "failed"; error: NormalizedApiError }
  | { kind: "ambiguous"; error: NormalizedApiError }
  | { kind: "applied_unreadable"; error: NormalizedApiError }
>;

type SettleWrite = (
  operation: CrmNotesAmbiguity["operation"],
  attempt: CrmWriteAttempt,
  send: SendWrite,
) => Promise<boolean>;

/**
 * Notes on one CRM record — MASTER-PLAN 8.24.
 *
 * Every write carries one idempotency key for its whole attempt, so the retry
 * offered after an unknown outcome replays rather than duplicates. Errors leave
 * here as `NormalizedApiError`, never as prose: the dictionary owns the words.
 */
export function useCrmNotes({ branchId, sourceType, sourceId }: CrmNotesSource) {
  const [notes, setNotes] = useState<CrmNote[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [writeError, setWriteError] = useState<NormalizedApiError | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [ambiguity, setAmbiguity] = useState<CrmNotesAmbiguity | null>(null);
  // D2: the write applied and its receipt could not be read. Kept apart from
  // `writeError`, which invites the user to type the note again — and on a
  // non-idempotent POST that is a second note.
  const [appliedUnreadable, setAppliedUnreadable] =
    useState<CrmAppliedUnreadable | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestEpochRef = useRef(0);

  const ready = isUUIDv7(branchId) && isUUIDv7(sourceId);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const epoch = requestEpochRef.current + 1;
      requestEpochRef.current = epoch;
      if (!isUUIDv7(branchId) || !isUUIDv7(sourceId)) {
        setNotes([]);
        setTotal(0);
        setLoadError(null);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await axiosClient.get<unknown>(
          buildCrmNotesListPath({
            branchId,
            sourceType,
            sourceId,
            page: 1,
            limit: NOTES_PAGE_SIZE,
          }),
          {
            signal,
            cache: "no-store",
            maxResponseBytes: NOTES_RESPONSE_LIMIT_BYTES,
          },
        );
        const page = parseCrmNotesPageResponse(response.data, {
          branchId,
          sourceType,
          sourceId,
        });
        if (epoch !== requestEpochRef.current) return;
        setNotes(page.items);
        setTotal(page.total);
      } catch (caught) {
        if (isAbortError(caught) || epoch !== requestEpochRef.current) return;
        setNotes([]);
        setTotal(0);
        setLoadError(normalizeApiError(caught));
      } finally {
        if (!signal?.aborted && epoch === requestEpochRef.current) {
          setIsLoading(false);
        }
      }
    },
    [branchId, sourceId, sourceType],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void load(controller.signal);
    });
    return () => controller.abort();
  }, [load, reloadToken]);

  const reload = useCallback(() => {
    setReloadToken((current) => current + 1);
  }, []);

  // A **named** function expression, not an arrow: the ambiguous branch's
  // `replay` calls this same function, and naming it puts it in its own scope
  // instead of reaching forward to the `const` being initialised.
  const settle: SettleWrite = useCallback(
    async function settleWrite(
      operation: CrmNotesAmbiguity["operation"],
      attempt: CrmWriteAttempt,
      send: SendWrite,
    ): Promise<boolean> {
      const outcome = await send();
      if (outcome.kind === "success") {
        setWriteError(null);
        setAmbiguity(null);
        await load();
        return true;
      }
      if (outcome.kind === "ambiguous") {
        setWriteError(null);
        setAmbiguity({
          operation,
          attempt,
          error: outcome.error,
          // The replay reuses `attempt`, so the server recognises the key and
          // returns the stored result instead of writing a second note.
          replay: async () => {
            await settleWrite(operation, attempt, send);
          },
        });
        // The record may already have changed underneath, so what is on screen
        // is refreshed even though the outcome is unknown.
        await load();
        return false;
      }
      if (outcome.kind === "applied_unreadable") {
        // D2: the note IS saved. Reloading is the whole remedy — what this
        // must never do is leave a form the user presses Save on again.
        setWriteError(null);
        setAmbiguity(null);
        setAppliedUnreadable({ attempt, error: outcome.error });
        await load();
        return false;
      }
      setAmbiguity(null);
      setWriteError(outcome.error);
      return false;
    },
    [load],
  );

  const create = useCallback(
    async (body: string): Promise<boolean> => {
      if (!isUUIDv7(branchId) || !isUUIDv7(sourceId) || isSaving) return false;
      const attempt = createCrmWriteAttempt();
      const payload = buildCreateCrmNoteRequest({
        branchId,
        sourceType,
        sourceId,
        body,
      });
      setIsSaving(true);
      try {
        return await settle(
          "create",
          attempt,
          async () =>
            await runCrmWrite({
              attempt,
              method: "post",
              path: CRM_NOTES_PATH,
              body: payload,
              parse: parseCrmNote,
              config: { maxResponseBytes: 256 * 1024 },
            }),
        );
      } finally {
        setIsSaving(false);
      }
    },
    [branchId, isSaving, settle, sourceId, sourceType],
  );

  const update = useCallback(
    async (noteId: string, body: string): Promise<boolean> => {
      if (pendingId !== null) return false;
      const attempt = createCrmWriteAttempt();
      const payload = buildUpdateCrmNoteRequest(body);
      setPendingId(noteId);
      try {
        return await settle(
          "update",
          attempt,
          async () =>
            await runCrmWrite({
              attempt,
              method: "patch",
              path: crmNotePath(noteId),
              body: payload,
              parse: parseCrmNote,
              config: { maxResponseBytes: 256 * 1024 },
            }),
        );
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, settle],
  );

  const remove = useCallback(
    async (noteId: string): Promise<boolean> => {
      if (pendingId !== null) return false;
      const attempt = createCrmWriteAttempt();
      setPendingId(noteId);
      try {
        return await settle(
          "delete",
          attempt,
          async () =>
            await runCrmWrite({
              attempt,
              method: "delete",
              path: crmNotePath(noteId),
              parse: expectNoContent,
              config: { maxResponseBytes: 64 * 1024 },
            }),
        );
      } finally {
        setPendingId(null);
      }
    },
    [pendingId, settle],
  );

  return {
    notes,
    total,
    ready,
    isLoading,
    loadError,
    writeError,
    clearWriteError: () => setWriteError(null),
    ambiguity,
    dismissAmbiguity: () => setAmbiguity(null),
    appliedUnreadable,
    dismissAppliedUnreadable: () => setAppliedUnreadable(null),
    isSaving,
    pendingId,
    reload,
    create,
    update,
    remove,
  };
}
