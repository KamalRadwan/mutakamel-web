"use client";

// Workflows are the same controller, the same DTOs and the same
// `trade.policy.*` permissions as policies — the family is the only
// difference, so the workspace is shared rather than duplicated. See
// policies/components/governance-workspace.tsx.
import { GovernanceWorkspace } from "../policies/components/governance-workspace";

export default function WorkflowsPage() {
  return <GovernanceWorkspace family="workflow" />;
}
