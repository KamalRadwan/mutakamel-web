import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";

/** A validated HTTP response failed the local model boundary, not the network. */
export class SettingsInvalidResponseError extends Error {}

export type SettingsReadFailure =
  | { kind: "invalid-response" }
  | { kind: "api"; error: NormalizedApiError };

export function classifySettingsFailure(error: unknown): SettingsReadFailure {
  return error instanceof SettingsInvalidResponseError
    ? { kind: "invalid-response" }
    : { kind: "api", error: normalizeApiError(error) };
}

export function isSettingsAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
