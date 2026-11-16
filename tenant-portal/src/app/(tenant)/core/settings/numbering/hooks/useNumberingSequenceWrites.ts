"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useToast } from "@/design-system";
import type { Dictionary } from "@/i18n/dictionaries/ar";
import { normalizeApiError } from "@/lib/api/errors";
import type { CompanyOption } from "../../company-options";
import {
  NumberingResponseValidationError,
  createNumberingSequence,
  updateNumberingSequence,
} from "../numbering-api";
import {
  buildCreateNumberingRequest,
  buildUpdateNumberingRequest,
  type NumberingFormValues,
  type NumberingSequence,
} from "../numbering-contract";
import { resolveNumberingWriteError } from "../numbering-errors";
import type { NumberingFieldErrors, NumberingFieldKey } from "../numbering-form-validation";

interface NumberingWriteOperation {
  readonly epoch: number;
  readonly authFenceKey: string;
  disposed: boolean;
}

interface NumberingPrivateState {
  readonly createOpen: boolean;
  readonly editing: NumberingSequence | null;
  readonly editingNotFound: boolean;
  readonly formError: string | null;
  readonly formFieldErrors: NumberingFieldErrors;
}

const CLOSED_PRIVATE_STATE: NumberingPrivateState = {
  createOpen: false,
  editing: null,
  editingNotFound: false,
  formError: null,
  formFieldErrors: {},
};

interface UseNumberingSequenceWritesOptions {
  readonly t: Dictionary;
  readonly authFenceKey: string;
  readonly rawCanManage: boolean;
  readonly isDenied: boolean;
  readonly canManage: boolean;
  readonly canCreate: boolean;
  readonly canManageScope: (companyId: string | null) => boolean;
  readonly companies: readonly CompanyOption[];
  readonly reload: () => Promise<void>;
}

/**
 * Owns numbering create/edit modal state, server validation feedback, and
 * write operation tokens so scope/actor rotation, authoritative 403 responses,
 * or unmount permanently dispose in-flight writes without releasing newer locks.
 */
export function useNumberingSequenceWrites({
  t, authFenceKey, rawCanManage, isDenied, canManage, canCreate, canManageScope, companies, reload,
}: UseNumberingSequenceWritesOptions) {
  const toast = useToast();
  const mountedRef = useRef(true);
  const latestAuthFenceRef = useRef(authFenceKey);
  const writeEpochRef = useRef(0);
  const activeWriteRef = useRef<NumberingWriteOperation | null>(null);

  const [trackedAuthKey, setTrackedAuthKey] = useState(authFenceKey);
  const [trackedRawCanManage, setTrackedRawCanManage] = useState(rawCanManage);
  const [trackedDenied, setTrackedDenied] = useState(isDenied);
  const [writeEpoch, setWriteEpoch] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [privateState, setPrivateState] = useState<NumberingPrivateState>(CLOSED_PRIVATE_STATE);

  const disposeActiveWrite = useCallback(() => {
    const current = activeWriteRef.current;
    if (!current) return;
    current.disposed = true;
    activeWriteRef.current = null;
  }, []);

  const dismissPrivateState = useCallback(() => {
    writeEpochRef.current += 1;
    disposeActiveWrite();
    if (!mountedRef.current) return;
    setWriteEpoch((epoch) => epoch + 1);
    setIsSubmitting(false);
    setPrivateState(CLOSED_PRIVATE_STATE);
  }, [disposeActiveWrite]);

  const shouldResetPrivateState =
    trackedAuthKey !== authFenceKey ||
    (trackedRawCanManage && !rawCanManage) ||
    (!trackedDenied && isDenied);

  if (
    trackedAuthKey !== authFenceKey ||
    trackedRawCanManage !== rawCanManage ||
    trackedDenied !== isDenied
  ) {
    setTrackedAuthKey(authFenceKey);
    setTrackedRawCanManage(rawCanManage);
    setTrackedDenied(isDenied);
    if (shouldResetPrivateState) {
      setWriteEpoch((epoch) => epoch + 1);
      setIsSubmitting(false);
      setPrivateState(CLOSED_PRIVATE_STATE);
    }
  }

  useEffect(() => {
    latestAuthFenceRef.current = authFenceKey;
    return () => {
      writeEpochRef.current += 1;
      disposeActiveWrite();
    };
  }, [authFenceKey, disposeActiveWrite]);

  useEffect(() => {
    if (writeEpochRef.current < writeEpoch) writeEpochRef.current = writeEpoch;
    const current = activeWriteRef.current;
    if (!canManage || isDenied || (current && current.epoch !== writeEpochRef.current)) {
      disposeActiveWrite();
    }
  }, [canManage, disposeActiveWrite, isDenied, writeEpoch]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      writeEpochRef.current += 1;
      disposeActiveWrite();
    };
  }, [disposeActiveWrite]);

  const hasActiveWrite = useCallback((): boolean => {
    const current = activeWriteRef.current;
    if (!current) return false;
    const currentEpoch = Math.max(writeEpoch, writeEpochRef.current);
    if (
      !mountedRef.current || current.disposed ||
      current.epoch !== currentEpoch || latestAuthFenceRef.current !== authFenceKey
    ) {
      current.disposed = true;
      activeWriteRef.current = null;
      return false;
    }
    return true;
  }, [authFenceKey, writeEpoch]);

  const isCurrentWrite = useCallback(
    (op: NumberingWriteOperation): boolean =>
      mountedRef.current &&
      !op.disposed &&
      activeWriteRef.current === op &&
      writeEpochRef.current === op.epoch &&
      latestAuthFenceRef.current === op.authFenceKey,
    [],
  );

  const clearServerFieldError = useCallback(
    (key?: NumberingFieldKey) => {
      if (!mountedRef.current || isDenied || !canManage) return;
      setPrivateState((prev) => {
        if (!key) {
          return Object.keys(prev.formFieldErrors).length === 0
            ? prev
            : { ...prev, formFieldErrors: {} };
        }
        if (!prev.formFieldErrors[key]) return prev;
        const nextErrors = { ...prev.formFieldErrors };
        delete nextErrors[key];
        return { ...prev, formFieldErrors: nextErrors };
      });
    },
    [canManage, isDenied],
  );

  const runWriteOperation = useCallback(
    async (options: {
      readonly mode: "create" | "edit";
      readonly scopeCompanyId: string | null;
      readonly current?: NumberingSequence;
      readonly execute: (isCurrent: () => boolean) => Promise<boolean>;
    }): Promise<boolean> => {
      if (
        !mountedRef.current || isDenied || !canManage ||
        (options.mode === "create" && !canCreate) ||
        !canManageScope(options.scopeCompanyId) || isSubmitting || hasActiveWrite()
      ) {
        return false;
      }

      const currentEpoch = Math.max(writeEpoch, writeEpochRef.current);
      writeEpochRef.current = currentEpoch;
      latestAuthFenceRef.current = authFenceKey;
      if (activeWriteRef.current) activeWriteRef.current.disposed = true;
      const op: NumberingWriteOperation = { epoch: currentEpoch, authFenceKey, disposed: false };
      activeWriteRef.current = op;
      setIsSubmitting(true);
      setPrivateState((prev) => ({ ...prev, formError: null, formFieldErrors: {} }));

      const checkCurrent = () => isCurrentWrite(op);
      try {
        return await options.execute(checkCurrent);
      } catch (error) {
        if (!checkCurrent()) return false;
        if (normalizeApiError(error).status === 403) {
          dismissPrivateState();
          return false;
        }
        if (error instanceof NumberingResponseValidationError) void reload();
        const resolved = resolveNumberingWriteError({
          mode: options.mode, error, scopeCompanyId: options.scopeCompanyId,
          current: options.current, companies, t,
        });
        if (resolved.notFound) {
          setPrivateState((prev) => ({ ...prev, editingNotFound: true, formError: null, formFieldErrors: {} }));
          void reload();
          return false;
        }
        setPrivateState((prev) => ({ ...prev, formError: resolved.bannerError, formFieldErrors: resolved.fieldErrors }));
        return false;
      } finally {
        if (activeWriteRef.current === op) {
          op.disposed = true;
          activeWriteRef.current = null;
          if (mountedRef.current && writeEpochRef.current === op.epoch && latestAuthFenceRef.current === op.authFenceKey) {
            setIsSubmitting(false);
          }
        }
      }
    },
    [
      authFenceKey, canCreate, canManage, canManageScope, companies,
      dismissPrivateState, hasActiveWrite, isCurrentWrite, isDenied, isSubmitting, reload, t, writeEpoch,
    ],
  );

  const create = useCallback(
    (values: NumberingFormValues): Promise<boolean> =>
      runWriteOperation({
        mode: "create",
        scopeCompanyId: values.companyId,
        execute: async (isCurrent) => {
          const request = buildCreateNumberingRequest(values);
          await createNumberingSequence(request);
          if (!isCurrent()) return false;
          setPrivateState(CLOSED_PRIVATE_STATE);
          toast.success(t.coreSettings.savedTitle, t.coreSettings.numberingCreated);
          await reload();
          return isCurrent();
        },
      }),
    [reload, runWriteOperation, t, toast],
  );

  const { createOpen, editing, editingNotFound, formError, formFieldErrors } = privateState;

  const update = useCallback(
    async (values: NumberingFormValues): Promise<boolean> => {
      if (!editing || editingNotFound) return false;
      const target = editing;
      return runWriteOperation({
        mode: "edit",
        scopeCompanyId: target.companyId,
        current: target,
        execute: async (isCurrent) => {
          const request = buildUpdateNumberingRequest(target, values);
          if (Object.keys(request).length === 0) {
            if (!isCurrent()) return false;
            setPrivateState(CLOSED_PRIVATE_STATE);
            return true;
          }
          await updateNumberingSequence(target.id, request);
          if (!isCurrent()) return false;
          setPrivateState(CLOSED_PRIVATE_STATE);
          toast.success(t.coreSettings.savedTitle, t.coreSettings.numberingUpdated);
          await reload();
          return isCurrent();
        },
      });
    },
    [editing, editingNotFound, reload, runWriteOperation, t, toast],
  );

  const openCreate = useCallback(() => {
    if (!mountedRef.current || isDenied || !canCreate || isSubmitting || hasActiveWrite()) return;
    setPrivateState({ ...CLOSED_PRIVATE_STATE, createOpen: true });
  }, [canCreate, hasActiveWrite, isDenied, isSubmitting]);

  const closeCreate = useCallback(() => {
    if (!mountedRef.current || isDenied || isSubmitting || hasActiveWrite()) return;
    setPrivateState(CLOSED_PRIVATE_STATE);
  }, [hasActiveWrite, isDenied, isSubmitting]);

  const openEdit = useCallback(
    (sequence: NumberingSequence) => {
      if (
        !mountedRef.current || isDenied || !canManage ||
        !canManageScope(sequence.companyId) || isSubmitting || hasActiveWrite()
      ) return;
      setPrivateState({ ...CLOSED_PRIVATE_STATE, editing: sequence });
    },
    [canManage, canManageScope, hasActiveWrite, isDenied, isSubmitting],
  );

  const closeEdit = useCallback(() => {
    if (!mountedRef.current || isDenied || isSubmitting || hasActiveWrite()) return;
    setPrivateState(CLOSED_PRIVATE_STATE);
  }, [hasActiveWrite, isDenied, isSubmitting]);

  return {
    dismissPrivateState, isSubmitting, formError, formFieldErrors, clearServerFieldError,
    createOpen, editing, editingNotFound, openCreate, closeCreate, openEdit, closeEdit, create, update,
  };
}
