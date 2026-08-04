import { describe, expect, it } from "vitest";
import { shouldResetDatabaseServerWriteKey } from "./database-server-idempotency";

describe("database server write idempotency", () => {
  it.each([400, 401, 403, 409, 422, 429])(
    "starts a new intent after a definitive %s response",
    (httpStatus) => {
      expect(
        shouldResetDatabaseServerWriteKey({
          httpStatus,
          errorCode: "DB_SERVER_NAME_TAKEN",
        }),
      ).toBe(true);
    },
  );

  it("keeps the exact key while Gateway reports the intent in flight", () => {
    expect(
      shouldResetDatabaseServerWriteKey({
        httpStatus: 409,
        errorCode: "GW.IDEM.IN_FLIGHT",
      }),
    ).toBe(false);
  });

  it.each([500, 502, 503, 504])(
    "keeps the exact key for an unknown %s outcome",
    (httpStatus) => {
      expect(
        shouldResetDatabaseServerWriteKey({
          httpStatus,
          errorCode: "UNKNOWN_ERROR",
        }),
      ).toBe(false);
    },
  );
});
