import type { StorageServerErrorCode } from "../types";

export function getErrorMessageAndDetails(
  error: any,
  lang: string
): { message: string; fieldErrors?: Record<string, string>; permissions?: string[] } {
  const resData = error?.response?.data;
  const errorCode = resData?.errorCode as StorageServerErrorCode;

  // Generic errors
  if (errorCode === "MISSING_REQUIRED_PERMISSIONS") {
    return {
      message:
        lang === "ar"
          ? "ليس لديك الصلاحيات الكافية للقيام بهذا الإجراء."
          : "You do not have the required permissions to perform this action.",
      permissions: resData?.details?.permissions,
    };
  }

  // Storage Server specific errors
  switch (errorCode) {
    case "STORAGE_SERVER_NOT_FOUND":
      return {
        message: lang === "ar" ? "خادم التخزين غير موجود." : "Storage server not found.",
      };
    case "STORAGE_SERVER_CODE_TAKEN":
      return {
        message:
          lang === "ar"
            ? "رمز خادم التخزين هذا قيد الاستخدام بالفعل."
            : "This storage server code is already in use.",
        fieldErrors: { code: lang === "ar" ? "مستخدم بالفعل" : "Already taken" },
      };
    case "STORAGE_SERVER_INVALID_TRANSITION":
      return {
        message:
          lang === "ar"
            ? "حالة الخادم الحالية لا تسمح بهذا الإجراء."
            : "The current state of the server does not allow this transition.",
      };
    case "STORAGE_SERVER_DRAIN_NOT_EMPTY":
      return {
        message:
          lang === "ar"
            ? "لا يمكن استنزاف الخادم لوجود مستأجرين حاليين."
            : "Cannot drain server because it still contains active tenants.",
      };
    case "STORAGE_SERVER_VERIFICATION_FAILED":
      return {
        message:
          lang === "ar"
            ? "فشل التحقق من الاتصال بخادم التخزين."
            : "Storage server connectivity verification failed.",
      };
    case "STORAGE_SERVER_ROUTING_OUTDATED":
      return {
        message:
          lang === "ar"
            ? "إعدادات التوجيه غير محدثة، يرجى إعادة المحاولة."
            : "Routing configuration is outdated, please refresh and retry.",
      };

    // Idempotency Errors
    case "GW.IDEM.MISSING":
    case "GW.IDEM.BAD_VALUE":
    case "GW.IDEM.IN_FLIGHT":
    case "GW.IDEM.MISMATCH":
      return {
        message:
          lang === "ar"
            ? "حدث خطأ في معالجة الطلب المتكرر. يرجى إعادة المحاولة لاحقاً."
            : "An idempotency error occurred. Please try again later.",
      };

    default:
      return {
        message:
          resData?.message ||
          (lang === "ar" ? "حدث خطأ غير متوقع." : "An unexpected error occurred."),
      };
  }
}
