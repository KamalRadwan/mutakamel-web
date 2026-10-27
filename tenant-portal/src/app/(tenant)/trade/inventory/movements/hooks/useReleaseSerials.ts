"use client";

import { useState } from "react";

export function useReleaseSerials(targetId: string) {
  const [draft, setDraft] = useState({ targetId, value: "" });
  return {
    value: draft.targetId === targetId ? draft.value : "",
    change: (value: string) => setDraft({ targetId, value }),
  };
}
