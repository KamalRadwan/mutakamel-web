import { describe, expect, it } from "vitest";
import {
  isAmbiguousWriteOutcome,
  shouldRotateWriteCommandKey,
} from "./write-command-recovery";

describe("write command recovery", () => {
  it.each([400, 401, 403, 404, 409, 422, 429])(
    "rotates after definitive HTTP %s",
    (httpStatus) => {
      expect(
        shouldRotateWriteCommandKey({ httpStatus, errorCode: `HTTP_${httpStatus}` }),
      ).toBe(true);
    },
  );

  it("retains the exact key for in-flight, unknown, and server outcomes", () => {
    expect(
      shouldRotateWriteCommandKey({
        httpStatus: 409,
        errorCode: "GW.IDEM.IN_FLIGHT",
      }),
    ).toBe(false);
    expect(
      shouldRotateWriteCommandKey({ httpStatus: 500, errorCode: "UNKNOWN_ERROR" }),
    ).toBe(false);
    expect(
      shouldRotateWriteCommandKey({ httpStatus: 503, errorCode: "HTTP_503" }),
    ).toBe(false);
  });

  it("classifies only retained outcomes as ambiguous", () => {
    expect(
      isAmbiguousWriteOutcome({ httpStatus: 409, errorCode: "GW.IDEM.IN_FLIGHT" }),
    ).toBe(true);
    expect(
      isAmbiguousWriteOutcome({ httpStatus: 503, errorCode: "HTTP_503" }),
    ).toBe(true);
    expect(
      isAmbiguousWriteOutcome({ httpStatus: 422, errorCode: "VALIDATION_FAILED" }),
    ).toBe(false);
  });
});

/**
 * FE-S05. A request that reached the server and settled, only for the admin
 * session epoch to move underneath it, is reported as a synthetic 409 - a
 * definitive-looking 4xx. Every predicate that read only status and code
 * therefore concluded the command never ran, and cleared the recovery key for a
 * command that may already have succeeded; the retry then carried a fresh
 * idempotency key, which the Gateway sees as a different command. A duplicate
 * backup or restore is the shape of that.
 *
 * `normalizeApiError` now carries the transport's marker onto the normalised
 * error, and these two predicates answer it before anything else.
 */
describe("settled before session change", () => {
  const settled = {
    httpStatus: 409,
    errorCode: "AUTH_SESSION_CHANGED",
    requestOutcome: "settled-before-session-change",
  } as const;

  it("keeps the key even though the status is a definitive 4xx", () => {
    expect(shouldRotateWriteCommandKey(settled)).toBe(false);
    expect(shouldRotateWriteCommandKey({ ...settled, requestOutcome: undefined })).toBe(
      true,
    );
  });

  it("treats the outcome as ambiguous, so recovery is offered", () => {
    expect(isAmbiguousWriteOutcome(settled)).toBe(true);
    expect(isAmbiguousWriteOutcome({ ...settled, requestOutcome: undefined })).toBe(
      false,
    );
  });

  it("overrides the status for every 4xx, not just 409", () => {
    for (const httpStatus of [400, 403, 404, 409, 422]) {
      expect(
        shouldRotateWriteCommandKey({ ...settled, httpStatus }),
      ).toBe(false);
      expect(isAmbiguousWriteOutcome({ ...settled, httpStatus })).toBe(true);
    }
  });
});
