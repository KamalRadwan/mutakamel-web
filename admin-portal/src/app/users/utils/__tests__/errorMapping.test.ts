import { describe, it, expect } from "vitest";
import { getErrorMessageAndDetails } from "../errorMapping";

describe("errorMapping tests", () => {
  it("correctly maps permission errors, not found, and email taken errors", () => {
    const mockErr = {
      response: {
        data: {
          errorCode: "MISSING_REQUIRED_PERMISSIONS",
          details: { permissions: ["admin.users.critical"] },
          correlationId: "uuid-v7-test",
        },
      },
    };

    const resultEn = getErrorMessageAndDetails(mockErr, "en");
    expect(resultEn.isPermissionError).toBe(true);
    expect(resultEn.message).toContain("admin.users.critical");

    const mockNotFound = {
      response: {
        data: {
          errorCode: "ADMIN_USER_NOT_FOUND",
        },
      },
    };
    const resultNotFound = getErrorMessageAndDetails(mockNotFound, "en");
    expect(resultNotFound.isNotFound).toBe(true);

    const mockEmail = {
      response: {
        data: {
          errorCode: "ADMIN_EMAIL_TAKEN",
        },
      },
    };
    const resultEmail = getErrorMessageAndDetails(mockEmail, "en");
    expect(resultEmail.fieldErrors?.email).toBeDefined();
  });
});
