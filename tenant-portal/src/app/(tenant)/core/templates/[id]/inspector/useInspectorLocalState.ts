"use client";
import { useCallback, useEffect, useState } from "react";
import type { InspectorLocalState } from "./inspector-ports";

export function useInspectorSession(onChange?: (state: InspectorLocalState) => void) {
  const [state, setState] = useState<InspectorLocalState | null>(null);
  const change = useCallback((next: InspectorLocalState) => {
    setState(old => JSON.stringify(old) === JSON.stringify(next) ? old : next);
    onChange?.(next);
  }, [onChange]);
  return { state, change };
}
export function useInspectorLocalState(state: InspectorLocalState, onChange?: (state: InspectorLocalState) => void) {
  const { ownerKey, nodeId, dirty, stale, disabled } = state;
  useEffect(() => { onChange?.({ ownerKey, nodeId, dirty, stale, disabled }); }, [ownerKey, nodeId, dirty, stale, disabled, onChange]);
  useEffect(() => () => onChange?.({ ownerKey, nodeId, dirty: false, stale: false, disabled: true }), [ownerKey, nodeId, onChange]);
}

export function useInspectorDialog(onChange?: (state: InspectorLocalState) => void) {
  const [open, setOpen] = useState(false), [dirty, setDirty] = useState(false), [confirmClose, setConfirmClose] = useState(false);
  const localState = useCallback((state: InspectorLocalState) => { setDirty(state.dirty); onChange?.(state); }, [onChange]);
  return { open, confirmClose, localState, change: (next: boolean) => { if (!next && dirty) { setConfirmClose(true); return; } setOpen(next); setConfirmClose(false); },
    keepEditing: () => setConfirmClose(false), discardClose: () => { setDirty(false); setConfirmClose(false); setOpen(false); } };
}
