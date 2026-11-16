"use client";
import { useState } from "react";
export type OpportunityDossierTab = "activities" | "notes" | "attachments" | "history";
export function useOpportunityDossierTabs() {
  const [active, setActive] = useState<OpportunityDossierTab>("activities");
  const [attachmentsVisited, setAttachmentsVisited] = useState(false);
  return { active, attachmentsVisited, select: (tab: OpportunityDossierTab) => { setActive(tab); if (tab === "attachments") setAttachmentsVisited(true); } };
}
