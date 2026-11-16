"use client";
import { useState } from "react";
import type { DraftValidationIssue } from "../../version-draft";
import type { VersionIssueFocus } from "../useVersionEditorFocus";
import type { WorkspaceTabKey } from "../VersionWorkspaceTabs";

export function useVersionWorkspaceInteractions(staleConflict: object | null, onChangeTab: (tab: WorkspaceTabKey) => void) {
  const [focusRequest, setFocusRequest] = useState<VersionIssueFocus | null>(null);
  const [dismissedConflict, setDismissedConflict] = useState<object | null>(null);
  const dismissConflict = () => { if (staleConflict) setDismissedConflict(staleConflict); };
  return {
    focusRequest,
    conflictDialogOpen: Boolean(staleConflict && staleConflict !== dismissedConflict),
    dismissConflict,
    onConflictOpenChange: (open: boolean) => { if (!open) dismissConflict(); },
    jumpToIssue: (issue: DraftValidationIssue) => {
      onChangeTab(issue.tab === "promotions" ? "promotions" : "prices");
      setFocusRequest(previous => ({ issue, request: (previous?.request ?? 0) + 1 }));
    },
  };
}
