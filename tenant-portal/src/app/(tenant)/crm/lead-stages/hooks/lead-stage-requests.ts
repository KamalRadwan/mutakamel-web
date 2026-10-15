import { TenantApiClientError } from "@/lib/api/axiosClient";

export const LEAD_STAGES_PATH = "/api/tenant/crm/v1/lead-stages";
export const LEAD_STAGES_REORDER_PATH = `${LEAD_STAGES_PATH}/reorder`;

export const NON_REPLAYABLE_MUTATION = {
  nonReplayable: true,
  skipAutoIdempotency: true,
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
} as const;

// Reorder is the one write here the Gateway declares `idempotent: true`
// (crm.lead.stages.reorder.patch), and it answers IDEM_MISSING without the
// key — so auto-idempotency stays on and the replay of a retried drop is the
// server's job, not a second reordering.
export const REPLAYABLE_MUTATION = {
  cache: "no-store",
  maxResponseBytes: 256 * 1024,
} as const;

export function leadStageErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isAmbiguousLeadStageMutation(error: unknown): boolean {
  return (
    !(error instanceof TenantApiClientError) || error.response.status >= 500
  );
}
