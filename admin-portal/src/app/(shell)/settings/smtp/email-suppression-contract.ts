// Local contract: core-app/src/tenant/email-suppression/email-suppression.dto.ts.
export interface EmailSuppressionAddress { address: string }
export type EmailSuppressionLookup =
  | { suppressed: false }
  | { suppressed: true; reasonCode: "HARD_BOUNCE" | "COMPLAINT"; firstOccurredAt: string; lastOccurredAt: string };
export interface EmailSuppressionLift { suppressed: false; lifted: boolean }

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_SUPPRESSION_RESPONSE");
  return value as Record<string, unknown>;
}

function data(value: unknown): Record<string, unknown> {
  const envelope = record(value);
  if (envelope.success !== true) throw new Error("INVALID_SUPPRESSION_RESPONSE");
  return record(envelope.data);
}

function date(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error("INVALID_SUPPRESSION_RESPONSE");
  }
  return value;
}

export function readSuppressionLookup(value: unknown): EmailSuppressionLookup {
  const result = data(value);
  if (result.suppressed === false) return { suppressed: false };
  if (result.suppressed !== true || (result.reasonCode !== "HARD_BOUNCE" && result.reasonCode !== "COMPLAINT")) {
    throw new Error("INVALID_SUPPRESSION_RESPONSE");
  }
  return { suppressed: true, reasonCode: result.reasonCode,
    firstOccurredAt: date(result.firstOccurredAt), lastOccurredAt: date(result.lastOccurredAt) };
}

export function readSuppressionLift(value: unknown): EmailSuppressionLift {
  const result = data(value);
  if (result.suppressed !== false || typeof result.lifted !== "boolean") throw new Error("INVALID_SUPPRESSION_RESPONSE");
  return { suppressed: false, lifted: result.lifted };
}

