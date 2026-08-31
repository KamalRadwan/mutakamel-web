"use client";

import { useCallback, useState } from "react";

/** Implements the form-drawer.md dirty-state guard: closing with unsaved changes asks for confirmation first. */
export function useFormDrawer(onClose: () => void, isDirty: boolean) {
  const [showDirtyGuard, setShowDirtyGuard] = useState(false);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setShowDirtyGuard(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const confirmDiscard = useCallback(() => {
    setShowDirtyGuard(false);
    onClose();
  }, [onClose]);

  const cancelDiscard = useCallback(() => setShowDirtyGuard(false), []);

  return { showDirtyGuard, requestClose, confirmDiscard, cancelDiscard };
}
