"use client";

import { useState } from "react";

export function usePipelineStageSelection(onAttach: (id: string) => void | Promise<boolean | void>) {
  const [selectedStageId, setSelectedStageId] = useState("");
  return {
    selectedStageId, setSelectedStageId,
    attach: async () => {
      if (!selectedStageId) return;
      // Keep the selected definition available for correction after a refusal.
      if (await onAttach(selectedStageId) !== false) setSelectedStageId("");
    },
  };
}
