"use client";
import { useEffect, useRef, useState } from "react";

export function useVersionTimelineSelection(selectedId: string | null, isDirty: boolean, onSelect: (id: string) => void) {
  const [pendingTargetId, setPendingTargetId] = useState<string | null>(null);
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const button = selectedButton.current;
    const rail = button?.parentElement;
    if (!button || !rail) return;
    const card = button.getBoundingClientRect();
    const viewport = rail.getBoundingClientRect();
    const delta = card.left < viewport.left ? card.left - viewport.left : card.right > viewport.right ? card.right - viewport.right : 0;
    // Move only the horizontal rail, keeping the page's reading position intact.
    if (delta) rail.scrollBy?.({ left: delta });
  }, [selectedId]);
  return {
    selectedButton,
    pendingTargetId,
    requestSelect: (id: string) => {
      if (id === selectedId) return;
      if (isDirty) setPendingTargetId(id);
      else onSelect(id);
    },
    onConfirmationOpenChange: (open: boolean) => { if (!open) setPendingTargetId(null); },
    confirmSelection: () => {
      setPendingTargetId(null);
      if (pendingTargetId) onSelect(pendingTargetId);
    },
  };
}
