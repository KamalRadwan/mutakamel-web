import { describe, expect, it } from "vitest";
import {
  findCatalogueCreateResult,
  isAmbiguousCatalogueCreateError,
  readPendingCatalogueCreateAttempt,
  type PendingCatalogueCreateAttempt,
} from "./catalogue-create-recovery";

const attempt: PendingCatalogueCreateAttempt = {
  applicationId: "019f0000-0000-7000-8000-000000000001",
  kind: "tier",
  resourceKey: "business",
  absenceConfirmed: false,
};

describe("catalogue create recovery", () => {
  it("treats non-replayable 401 and unknown/server outcomes as ambiguous", () => {
    expect(isAmbiguousCatalogueCreateError({ httpStatus: 401, errorCode: "HTTP_401" })).toBe(true);
    expect(isAmbiguousCatalogueCreateError({ httpStatus: 503, errorCode: "HTTP_503" })).toBe(true);
    expect(isAmbiguousCatalogueCreateError({ httpStatus: 422, errorCode: "VALIDATION" })).toBe(false);
  });

  it("reconciles by immutable resource key", () => {
    const tier = { id: "tier-1", key: "business" } as never;
    expect(findCatalogueCreateResult(attempt, [tier], [])).toBe(tier);
    expect(findCatalogueCreateResult({ ...attempt, resourceKey: "missing" }, [tier], [])).toBeNull();
  });

  it("accepts only minimal persisted attempt evidence", () => {
    expect(readPendingCatalogueCreateAttempt(JSON.stringify(attempt))).toEqual(attempt);
    expect(readPendingCatalogueCreateAttempt(JSON.stringify({ ...attempt, resourceKey: "" }))).toBeNull();
    expect(readPendingCatalogueCreateAttempt("not-json")).toBeNull();
  });
});
