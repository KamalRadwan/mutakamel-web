"use client";

import { useState } from "react";
import { MOVEMENT_LINES_MAX, type ReversalLineValues } from "../movements-contract";

export function useReversalLines(targetId: string) {
  const [draft, setDraft] = useState<{ targetId: string; lines: ReversalLineValues[] }>({ targetId, lines: [] });
  const lines = draft.targetId === targetId ? draft.lines : [];
  const update = (next: ReversalLineValues[]) => setDraft({ targetId, lines: next });
  return {
    lines,
    add: () => { if (lines.length < MOVEMENT_LINES_MAX) update([...lines, { lineId: "", quantity: "", serialKeys: "" }]); },
    remove: (index: number) => update(lines.filter((_, position) => position !== index)),
    change: (index: number, patch: Partial<ReversalLineValues>) =>
      update(lines.map((line, position) => position === index ? { ...line, ...patch } : line)),
    clear: () => update([]),
  };
}
