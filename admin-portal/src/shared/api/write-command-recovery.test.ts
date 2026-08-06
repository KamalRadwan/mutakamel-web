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
