"use client";

import { useCallback, useEffect, useState } from "react";
import { generateUUIDv7 } from "@/lib/utils/uuid";
import {
  BACKUP_NON_IDEMPOTENT_GUARD_CHANGE_EVENT,
  BACKUP_NON_IDEMPOTENT_GUARD_STORAGE_KEY,
  clearBackupNonIdempotentCommandAttempt,
  markBackupNonIdempotentCommandUnknown,
  readBackupNonIdempotentCommandAttempt,
  writeBackupNonIdempotentCommandAttempt,
  type BackupNonIdempotentCommandAttempt,
  type BackupNonIdempotentCommandKind,
} from "./non-idempotent-command-guard";
import { safeStorage } from "@/lib/safeStorage";

const storageFailureMessage =
  "Durable command protection is unavailable. Non-idempotent commands are disabled.";

function notifyGuardChange() {
  window.dispatchEvent(
    new Event(BACKUP_NON_IDEMPOTENT_GUARD_CHANGE_EVENT),
  );
}

export function useBackupNonIdempotentCommandGuard() {
  const [attempt, setAttempt] =
    useState<BackupNonIdempotentCommandAttempt | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const syncFromStorage = useCallback(() => {
    try {
      setAttempt(readBackupNonIdempotentCommandAttempt(safeStorage));
      setStorageError(null);
    } catch {
      setAttempt(null);
      setStorageError(storageFailureMessage);
    } finally {
      setIsReady(true);
    }
  }, []);

  useEffect(() => {
    syncFromStorage();

    const onStorage = (event: StorageEvent) => {
      if (
        event.key === null ||
        event.key === BACKUP_NON_IDEMPOTENT_GUARD_STORAGE_KEY
      ) {
        syncFromStorage();
      }
    };
    const onLocalChange = () => syncFromStorage();

    window.addEventListener("storage", onStorage);
    window.addEventListener(
      BACKUP_NON_IDEMPOTENT_GUARD_CHANGE_EVENT,
      onLocalChange,
    );
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(
        BACKUP_NON_IDEMPOTENT_GUARD_CHANGE_EVENT,
        onLocalChange,
      );
    };
  }, [syncFromStorage]);

  const begin = useCallback(
    (
      kind: BackupNonIdempotentCommandKind,
      targetId: string,
    ): BackupNonIdempotentCommandAttempt | null => {
      if (!isReady || storageError) return null;

      try {
        const existing = readBackupNonIdempotentCommandAttempt(
          safeStorage,
        );
        if (existing) {
          setAttempt(existing);
          return null;
        }

        const candidate: BackupNonIdempotentCommandAttempt = {
          kind,
          targetId,
          issuedAt: new Date().toISOString(),
          localCommandId: generateUUIDv7(),
          status: "IN_FLIGHT",
        };
        writeBackupNonIdempotentCommandAttempt(
          safeStorage,
          candidate,
        );

        const confirmed = readBackupNonIdempotentCommandAttempt(
          safeStorage,
        );
        if (confirmed?.localCommandId !== candidate.localCommandId) {
          setAttempt(confirmed);
          return null;
        }

        setAttempt(candidate);
        setStorageError(null);
        notifyGuardChange();
        return candidate;
      } catch {
        setStorageError(storageFailureMessage);
        return null;
      }
    },
    [isReady, storageError],
  );

  const markUnknown = useCallback((localCommandId: string): boolean => {
    try {
      const next = markBackupNonIdempotentCommandUnknown(
        safeStorage,
        localCommandId,
      );
      setAttempt(next);
      setStorageError(null);
      notifyGuardChange();
      return next?.localCommandId === localCommandId;
    } catch {
      setStorageError(storageFailureMessage);
      return false;
    }
  }, []);

  const clear = useCallback((localCommandId: string): boolean => {
    try {
      const current = readBackupNonIdempotentCommandAttempt(
        safeStorage,
      );
      if (!current) {
        setAttempt(null);
        setStorageError(null);
        return true;
      }
      if (current.localCommandId !== localCommandId) {
        setAttempt(current);
        return false;
      }

      const cleared = clearBackupNonIdempotentCommandAttempt(
        safeStorage,
        localCommandId,
      );
      if (cleared) {
        setAttempt(null);
        setStorageError(null);
        notifyGuardChange();
      }
      return cleared;
    } catch {
      setStorageError(storageFailureMessage);
      return false;
    }
  }, []);

  return {
    attempt,
    storageError,
    isReady,
    isBlocked: !isReady || storageError !== null || attempt !== null,
    begin,
    markUnknown,
    clear,
  };
}
