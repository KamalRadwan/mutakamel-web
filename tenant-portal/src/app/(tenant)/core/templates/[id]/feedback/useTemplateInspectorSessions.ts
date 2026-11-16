"use client";

import { useCallback, useState } from "react";
import type { InspectorLocalState } from "../inspector/inspector-ports";

/** Owner/node-keyed local sessions; no authored state or save-flight duplication. */
export function useTemplateInspectorSessions(ownerKey: string, current: () => boolean, onChange?: (state: InspectorLocalState) => void) {
  const [sessions, setSessions] = useState<ReadonlyMap<string, InspectorLocalState>>(new Map());
  const change = useCallback((next: InspectorLocalState) => {
    if (!current() || next.ownerKey !== ownerKey) return;
    setSessions(previous => {
      const old = previous.get(next.nodeId);
      if (!next.dirty && !old) return previous;
      if (next.dirty && old?.ownerKey === next.ownerKey && old.stale === next.stale && old.disabled === next.disabled) return previous;
      const result = new Map(previous);
      if (next.dirty) result.set(next.nodeId, next); else result.delete(next.nodeId);
      return result;
    });
    onChange?.(next);
  }, [current, onChange, ownerKey]);
  return { change, pending: Array.from(sessions.values()).some(session => session.ownerKey === ownerKey && session.dirty) };
}
