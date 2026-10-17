"use client";

import { useState } from "react";

export type LeadPanel = "history" | "activities" | "attachments";

export function useLeadSidePanel(initialTab: LeadPanel = "history") {
  const [active, setActive] = useState<LeadPanel>(initialTab);
  const [visited, setVisited] = useState({
    activities: initialTab === "activities",
    attachments: initialTab === "attachments",
  });
  function select(value: string) {
    if (value !== "history" && value !== "activities" && value !== "attachments") return;
    setActive(value);
    if (value !== "history") setVisited((current) => ({ ...current, [value]: true }));
  }
  return { active, visited, select };
}
