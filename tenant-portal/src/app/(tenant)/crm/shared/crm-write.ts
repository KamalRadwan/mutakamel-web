// One mutating-call discipline for every CRM write — MASTER-PLAN S8, and the
// idempotency section of docs/design/detail-screens.md.
//
// Three rules this exists to make unavoidable:
//
// 1. **One key per attempt, reused on every retry of that attempt.** The
//    transport mints a fresh `x-idempotency-key` per request when the caller
//    supplies none (axiosClient.ts, prepareRequest). For a retry that is
//    exactly wrong: a new key is a second write. Lead conversion creates a
//    customer, its contacts and an opportunity in one call, so a second write
//    is duplicate records a human has to merge by hand.
// 2. **`Idempotency-Replayed: true` is a success.** The Gateway served the
//    stored result of a write that already ran; nothing was rejected and
//    "already exists" would be a lie.
// 3. **A write whose outcome is unknown is neither success nor failure.** A
//    transport failure or a 5xx may have applied server-side. It renders
//    `AmbiguousOutcomePanel` with the key, and the retry replays that key.

import {
  TenantApiClientError,
  axiosClient,
  type AxiosResponse,
  type TenantApiRequestConfig,
} from "@/lib/api/axiosClient";
import { normalizeApiError, type NormalizedApiError } from "@/lib/api/errors";
import { isIdempotentReplay } from "@/lib/api/outcomes";
import { generateUUIDv7 } from "@/lib/uuid";

export const IDEMPOTENCY_KEY_HEADER = "x-idempotency-key";

/** The stable identity of one user-initiated write, retries included. */
export interface CrmWriteAttempt {
  idempotencyKey: string;
}

export function createCrmWriteAttempt(): CrmWriteAttempt {
  return { idempotencyKey: generateUUIDv7() };
}

/**
 * Four outcomes, because "the write did not happen" and "the write happened
 * and I cannot read the receipt" need different next actions — defect D2.
 *
 * `applied_unreadable` used to be reported as `failed` with a 2xx status. A
 * plain failure invites the user to fill the form in again and press Save, and
 * on a non-idempotent route that second attempt — a FRESH intent, with a fresh
 * key — is a duplicate record. The row very probably exists; what is missing is
 * only this client's ability to read the body describing it.
 */
export type CrmWriteOutcome<T> =
  | { kind: "success"; value: T; replayed: boolean }
  | { kind: "failed"; error: NormalizedApiError }
  | { kind: "ambiguous"; error: NormalizedApiError }
  | { kind: "applied_unreadable"; error: NormalizedApiError };

type CrmWriteMethod = "post" | "patch" | "put" | "delete";

/**
 * True when the request never reached a definite server answer.
 *
 * A `TenantApiClientError` below 500 is a decision the server made and the
 * write did not happen. Anything else — a network drop, a timeout, a 5xx —
 * leaves the outcome unknown.
 */
export function isAmbiguousWriteFailure(error: unknown): boolean {
  return !(error instanceof TenantApiClientError) || error.response.status >= 500;
}

export interface CrmWriteOptions<T> {
  attempt: CrmWriteAttempt;
  method: CrmWriteMethod;
  path: string;
  body?: unknown;
  /** Runs on the response body. Throwing here is a failed write, not a bad one. */
  parse: (payload: unknown, response: AxiosResponse<unknown>) => T;
  /** Extra request config — scope headers, a byte bound, an abort signal. */
  config?: TenantApiRequestConfig;
}

/**
 * Sends one CRM write carrying the attempt's key, and classifies the result.
 *
 * `skipAutoIdempotency` is set because the key is supplied explicitly; leaving
 * the transport to mint one would defeat rule 1 above on every retry.
 */
export async function runCrmWrite<T>({
  attempt,
  method,
  path,
  body,
  parse,
  config,
}: CrmWriteOptions<T>): Promise<CrmWriteOutcome<T>> {
  const requestConfig: TenantApiRequestConfig = {
    ...config,
    skipAutoIdempotency: true,
    cache: "no-store",
    headers: {
      ...(config?.headers as Record<string, string> | undefined),
      [IDEMPOTENCY_KEY_HEADER]: attempt.idempotencyKey,
    },
  };

  let response: AxiosResponse<unknown>;
  try {
    response =
      method === "delete"
        ? await axiosClient.delete<unknown>(path, requestConfig)
        : await axiosClient[method]<unknown>(path, body, requestConfig);
  } catch (caught) {
    const error = normalizeApiError(caught);
    return isAmbiguousWriteFailure(caught)
      ? { kind: "ambiguous", error }
      : { kind: "failed", error };
  }

  // Parsing sits outside the try on purpose. A body this client cannot read is
  // a **contract** failure of a write that already applied, so it is neither
  // ambiguous — replaying the key returns the same unreadable body — nor
  // failed, which is what it used to be called. `applied_unreadable` says the
  // one thing the caller has to act on: the record is on the server, so
  // reconcile, and do not offer a fresh Save that would write it twice.
  try {
    return {
      kind: "success",
      value: parse(response.data, response),
      replayed: isIdempotentReplay(response.headers),
    };
  } catch (caught) {
    return {
      kind: "applied_unreadable",
      error: {
        status: response.status,
        code: WRITE_APPLIED_UNREADABLE,
        message: caught instanceof Error ? caught.message : undefined,
      },
    };
  }
}

/** The code carried by an `applied_unreadable` outcome. */
export const WRITE_APPLIED_UNREADABLE = "CRM_WRITE_APPLIED_UNREADABLE";

/**
 * What a screen holds after an `applied_unreadable` outcome.
 *
 * It carries the attempt for the same reason the ambiguous panel does — the key
 * is the evidence a person needs to find the record that was written — but the
 * action offered beside it is a REFRESH, never a retry. Nothing here may lead
 * back to a fresh Save.
 */
export interface CrmAppliedUnreadable {
  attempt: CrmWriteAttempt;
  error: NormalizedApiError;
}

/** A `204` write. The body is empty by contract, so there is nothing to parse. */
export function expectNoContent(): null {
  return null;
}
