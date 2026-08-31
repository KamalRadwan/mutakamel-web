import { describe, expect, it } from "vitest";
import {
  PendingAdminUserWriteError,
  claimAdminUserWriteIntent,
  settleAdminUserWriteIntent,
} from "./writeIntent";

const FIRST = "019f0000-0000-7000-8000-000000000001";

describe("admin user write intents", () => {
  it("reuses one key only for the exact method/path/body", () => {
    const first = claimAdminUserWriteIntent(
      null,
      "PATCH",
      "/users/one",
      { firstName: "Ada" },
      () => FIRST,
    );
    const retry = claimAdminUserWriteIntent(
      { ...first, ambiguous: true },
      "PATCH",
      "/users/one",
      { firstName: "Ada" },
    );
    expect(retry.idempotencyKey).toBe(FIRST);
    expect(() =>
      claimAdminUserWriteIntent(
        { ...first, ambiguous: true },
        "PATCH",
        "/users/one",
        { firstName: "Grace" },
      ),
    ).toThrow(PendingAdminUserWriteError);
  });

  it("retains ambiguous outcomes and rotates definitive client failures", () => {
    const intent = claimAdminUserWriteIntent(
      null,
      "DELETE",
      "/users/one",
      null,
      () => FIRST,
    );
    expect(
      settleAdminUserWriteIntent(intent, new Error("network"), {
        isNormalized: true,
        httpStatus: 500,
        errorCode: "UNKNOWN_ERROR",
        message: "network",
      }),
    ).toMatchObject({ idempotencyKey: FIRST, ambiguous: true });
    expect(
      settleAdminUserWriteIntent(intent, {}, {
        isNormalized: true,
        httpStatus: 422,
        errorCode: "VALIDATION_FAILED",
        message: "bad",
      }),
    ).toBeNull();
  });
});
