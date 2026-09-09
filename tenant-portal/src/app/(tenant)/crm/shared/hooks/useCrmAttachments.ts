"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { readAllCrmAttachments } from "./readCrmAttachments";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isUUIDv7 } from "@/lib/uuid";
import {
  CRM_ATTACHMENTS_PATH,
  buildCrmAttachmentUploadBody,
  classifyAttachmentUploadFailure,
  crmAttachmentPath,
  parseCrmAttachment,
  type CrmAttachment,
  type CrmAttachmentSourceType,
  type CrmAttachmentUploadFailure,
} from "../attachments-contract";
import {
  createCrmWriteAttempt,
  expectNoContent,
  runCrmWrite,
  type CrmAppliedUnreadable,
  type CrmWriteAttempt,
} from "../crm-write";

export interface CrmAttachmentsSource {
  branchId: string | null;
  sourceType: CrmAttachmentSourceType;
  sourceId: string | null;
}

export interface CrmAttachmentsAmbiguity {
  operation: "upload" | "delete";
  attempt: CrmWriteAttempt;
  error: NormalizedApiError;
  replay: () => Promise<void>;
}

type SendWrite = () => Promise<
  | { kind: "success" }
  | { kind: "failed"; error: NormalizedApiError }
  | { kind: "ambiguous"; error: NormalizedApiError }
  | { kind: "applied_unreadable"; error: NormalizedApiError }
>;

type SettleWrite = (
  operation: CrmAttachmentsAmbiguity["operation"],
  attempt: CrmWriteAttempt,
  send: SendWrite,
) => Promise<boolean>;

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Attachments on one CRM record — MASTER-PLAN 8.25.
 *
 * Upload goes out as `multipart/form-data`. The transport leaves a `FormData`
 * body alone and sets no `Content-Type`, so the browser writes the boundary
 * itself — setting it by hand produces a body multer cannot parse.
 *
 * `uploadFailure` is the classified reason, not a message: the three distinct
 * outcomes (missing file / wrong type / too large) get three distinct
 * sentences from the dictionary at the call site.
 */
export function useCrmAttachments({
  branchId,
  sourceType,
  sourceId,
}: CrmAttachmentsSource) {
  const [attachments, setAttachments] = useState<CrmAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<NormalizedApiError | null>(null);
  const [uploadFailure, setUploadFailure] =
    useState<CrmAttachmentUploadFailure | null>(null);
  const [writeError, setWriteError] = useState<NormalizedApiError | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [ambiguity, setAmbiguity] = useState<CrmAttachmentsAmbiguity | null>(
    null,
  );
  // D2: the write applied and its receipt could not be read. Kept apart from
  // `writeError` and `uploadFailure` because both of those invite the user to
  // do it again, which is the one thing this outcome forbids.
  const [appliedUnreadable, setAppliedUnreadable] =
    useState<CrmAppliedUnreadable | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestEpochRef = useRef(0);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const epoch = requestEpochRef.current + 1;
      requestEpochRef.current = epoch;
      if (!isUUIDv7(branchId) || !isUUIDv7(sourceId)) {
        setAttachments([]);
        setLoadError(null);
        return;
      }
      setIsLoading(true);
      setLoadError(null);
      try {
        const rows = await readAllCrmAttachments({ branchId, sourceType, sourceId }, signal);
        if (signal?.aborted || epoch !== requestEpochRef.current) return;
        setAttachments(rows);
      } catch (caught) {
        if (signal?.aborted || isAbortError(caught) || epoch !== requestEpochRef.current) return;
        setAttachments([]);
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

  // A named function expression so the ambiguous branch's `replay` can call
  // this same function without a forward reference to the const.
  const settle: SettleWrite = useCallback(
    async function settleWrite(operation, attempt, send) {
      const outcome = await send();
      if (outcome.kind === "success") {
        setWriteError(null);
        setUploadFailure(null);
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
          replay: async () => {
            await settleWrite(operation, attempt, send);
          },
        });
        await load();
        return false;
      }
      if (outcome.kind === "applied_unreadable") {
        // D2: the file IS attached. Reporting this as an upload failure sent
        // the user back to the file picker, and the second upload was a second
        // attachment. The list is reloaded and the panel offers only that.
        setWriteError(null);
        setUploadFailure(null);
        setAmbiguity(null);
        setAppliedUnreadable({ attempt, error: outcome.error });
        await load();
        return false;
      }
      setAmbiguity(null);
      if (operation === "upload") {
        setUploadFailure(classifyAttachmentUploadFailure(outcome.error));
        setWriteError(null);
      } else {
        setWriteError(outcome.error);
      }
      return false;
    },
    [load],
  );

  const upload = useCallback(
    async (file: File): Promise<boolean> => {
      if (!isUUIDv7(branchId) || !isUUIDv7(sourceId) || isUploading) {
        return false;
      }
      const attempt = createCrmWriteAttempt();
      const body = buildCrmAttachmentUploadBody({
        file,
        branchId,
        sourceType,
        sourceId,
      });
      setIsUploading(true);
      setUploadFailure(null);
      try {
        return await settle(
          "upload",
          attempt,
          async () =>
            await runCrmWrite({
              attempt,
              method: "post",
              path: `${CRM_ATTACHMENTS_PATH}/upload`,
              body,
              parse: parseCrmAttachment,
              config: { maxResponseBytes: 256 * 1024 },
            }),
        );
      } finally {
        setIsUploading(false);
      }
    },
    [branchId, isUploading, settle, sourceId, sourceType],
  );

  const remove = useCallback(
    async (attachmentId: string): Promise<boolean> => {
      if (pendingId !== null) return false;
      const attempt = createCrmWriteAttempt();
      setPendingId(attachmentId);
      try {
        return await settle(
          "delete",
          attempt,
          async () =>
            await runCrmWrite({
              attempt,
              method: "delete",
              path: crmAttachmentPath(attachmentId),
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
    attachments,
    isLoading,
    loadError,
    uploadFailure,
    clearUploadFailure: () => setUploadFailure(null),
    writeError,
    clearWriteError: () => setWriteError(null),
    ambiguity,
    dismissAmbiguity: () => setAmbiguity(null),
    appliedUnreadable,
    dismissAppliedUnreadable: () => setAppliedUnreadable(null),
    isUploading,
    pendingId,
    reload,
    upload,
    remove,
  };
}
