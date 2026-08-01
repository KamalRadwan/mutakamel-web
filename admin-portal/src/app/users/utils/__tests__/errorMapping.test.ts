import { getErrorMessageAndDetails } from "../errorMapping";

export function testErrorMapping() {
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
  if (!resultEn.isPermissionError) {
    throw new Error("Expected isPermissionError to be true");
  }
  if (!resultEn.message.includes("admin.users.critical")) {
    throw new Error("Expected message to include permission key");
  }

  const mockNotFound = {
    response: {
      data: {
        errorCode: "ADMIN_USER_NOT_FOUND",
      },
    },
  };
  const resultNotFound = getErrorMessageAndDetails(mockNotFound, "en");
  if (!resultNotFound.isNotFound) {
    throw new Error("Expected isNotFound to be true");
  }

  const mockEmail = {
    response: {
      data: {
        errorCode: "ADMIN_EMAIL_TAKEN",
      },
    },
  };
  const resultEmail = getErrorMessageAndDetails(mockEmail, "en");
  if (!resultEmail.fieldErrors?.email) {
    throw new Error("Expected fieldErrors.email to be present");
  }
}
