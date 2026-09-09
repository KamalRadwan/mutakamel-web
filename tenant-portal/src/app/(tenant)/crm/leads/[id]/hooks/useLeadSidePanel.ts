"use client";

import { useState } from "react";

type LeadPanel = "history" | "activities" | "attachments";

export function useLeadSidePanel() {
  const [active, setActive] = useState<LeadPanel>("history");
  const [visited, setVisited] = useState({ activities: false, attachments: false });
  function select(value: string) {
    if (value !== "history" && value !== "activities" && value !== "attachments") return;
    setActive(value);
    if (value !== "history") setVisited((current) => ({ ...current, [value]: true }));
  }
  return { active, visited, select };
}
