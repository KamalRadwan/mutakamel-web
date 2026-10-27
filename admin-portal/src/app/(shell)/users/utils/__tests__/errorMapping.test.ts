import { describe, it, expect } from "vitest";
import { getErrorMessageAndDetails } from "../errorMapping";

describe("errorMapping tests", () => {
  it.each([
    ['ADMIN_INVITE_NOT_PENDING', 'Only pending administrator invitations can be resent.', 'يمكن إعادة إرسال دعوات المشرفين المعلّقة فقط.'],
    ['ADMIN_INVITE_RESEND_THROTTLED', 'Wait one minute between administrator invitations.', 'انتظر دقيقة بين إرسال دعوات المشرف.'],
    ['ADMIN_INVITE_DELIVERY_UNAVAILABLE', 'Invitation delivery could not be queued. Please retry.', 'تعذّر وضع الدعوة في قائمة الإرسال. يُرجى المحاولة مجددًا.'],
  ])('localizes %s in both languages and preserves correlation', (code, en, ar) => {
    for (const lang of ['en', 'ar'] as const) {
      const result = getErrorMessageAndDetails({ response: { data: { errorCode: code, correlationId: 'invite' } } }, lang);
      expect(result.message).toBe(lang === 'ar' ? ar : en);
      expect(result.correlationId).toBe('invite');
    }
  });
  it.each(["en", "ar"] as const)("maps inactive admin conflicts in %s without a not-found state", (lang) => {
    const result = getErrorMessageAndDetails({
      response: {
        data: {
          errorCode: "ADMIN_USER_NOT_ACTIVE",
          correlationId: "role-conflict",
        },
      },
    }, lang);

    expect(result.message).toBe(lang === "ar"
      ? "لا يمكن تعيين الأدوار إلا لمستخدمي الإدارة النشطين."
      : "Roles can only be assigned to active admin users.");
    expect(result.correlationId).toBe("role-conflict");
    expect(result.isNotFound).toBeUndefined();
  });

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
