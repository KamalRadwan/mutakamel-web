import { normalizeErrorCode } from "../api/adminUsersApi";

export interface MappedErrorDetails {
  code: string | null;
  message: string;
  fieldErrors?: Record<string, string>;
  correlationId?: string;
  isPermissionError?: boolean;
  isNotFound?: boolean;
  isSelfForbidden?: boolean;
}

export function getErrorMessageAndDetails(
  error: unknown,
  lang: "ar" | "en" = "en"
): MappedErrorDetails {
  const code = normalizeErrorCode(error);
  const errorObj = error as Record<string, unknown>;
  const response = errorObj?.response as Record<string, unknown> | undefined;
  const data = response?.data as Record<string, unknown> | undefined;
  const correlationId = (data?.correlationId as string) || (errorObj?.correlationId as string) || "";
  const serverMsg = (data?.message as string) || (data?.detail as string) || (data?.title as string);

  const isAr = lang === "ar";
  const fieldErrors: Record<string, string> = {};

  if (!code) {
    return {
      code: null,
      message: serverMsg || (isAr ? "حدث خطأ غير متوقع." : "An unexpected error occurred."),
      correlationId,
    };
  }

  switch (code) {
    case "MISSING_REQUIRED_PERMISSIONS": {
      const details = data?.details as Record<string, unknown> | undefined;
      const requiredPerms = (details?.permissions as string[] | undefined)?.join(", ");
      return {
        code,
        message: isAr
          ? `عفواً، لا تملك الصلاحيات المطلوبة لهذا الإجراء${requiredPerms ? `: (${requiredPerms})` : ""}.`
          : `Missing required permissions${requiredPerms ? `: (${requiredPerms})` : "."}`,
        correlationId,
        isPermissionError: true,
      };
    }

    case "ADMIN_USER_NOT_FOUND":
      return {
        code,
        message: isAr
          ? "لم يتم العثور على حساب المشرف المطلوبة، ربما تم حذفه."
          : "The specified admin user could not be found or has been deleted.",
        correlationId,
        isNotFound: true,
      };

    case "ADMIN_EMAIL_TAKEN": {
      const msg = isAr
        ? "البريد الإلكتروني مستخدم بالفعل لحساب مشرف آخر."
        : "This email address is already registered to another admin.";
      fieldErrors.email = msg;
      return {
        code,
        message: msg,
        fieldErrors,
        correlationId,
      };
    }

    case "ROLE_NOT_FOUND": {
      const msg = isAr
        ? "الدور المحدد غير موجود، يرجى إعادة تحميل القائمة."
        : "The selected role was not found. Please refresh and select again.";
      fieldErrors.roleId = msg;
      return {
        code,
        message: msg,
        fieldErrors,
        correlationId,
      };
    }

    case "ADMIN_SELF_FORBIDDEN":
      return {
        code,
        message: isAr
          ? "لا يمكنك تنفيذ هذا الإجراء على حسابك الخاص."
          : "You cannot perform this action on your own admin account.",
        correlationId,
        isSelfForbidden: true,
      };

    case "ADMIN_SELF_ROLE_CHANGE_FORBIDDEN":
      return {
        code,
        message: isAr
          ? "لا يمكنك تعديل دور حسابك الخاص بنفسك."
          : "An administrator cannot modify their own role.",
        correlationId,
        isSelfForbidden: true,
      };

    case "ADMIN_LAST_SUPER_ADMIN":
      return {
        code,
        message: isAr
          ? "لا يمكن تعديل أو حذف آخر مدير خارق (Super Admin) في النظام."
          : "Cannot suspend or delete the last remaining active Super Admin.",
        correlationId,
      };

    case "ADMIN_LAST_ROLE_MANAGER":
      return {
        code,
        message: isAr
          ? "لا يمكن سحب الدور من آخر مشرف يمتلك صلاحية إدارة الأدوار."
          : "Cannot change the role of the last active role manager.",
        correlationId,
      };

    case "ADMIN_INVITE_PENDING":
      return {
        code,
        message: isAr
          ? "المشرف ما زال في حالة (معلق الدعوة)، يجب قبول الدعوة أولاً لاستكمال الإجراء."
          : "This account is still INVITED. The invitation must be accepted first.",
        correlationId,
      };

    case "ADMIN_SUPER_ADMIN_REQUIRED":
      return {
        code,
        message: isAr
          ? "يتطلب هذا الإجراء صلاحية مدير خارق (Super Admin)."
          : "Only a database-backed Super Admin can perform this action.",
        correlationId,
      };

    case "ROLE_PERMISSION_ESCALATION":
      return {
        code,
        message: isAr
          ? "الدور المحدد يحتوي على صلاحيات تتجاوز صلاحياتك الحالية."
          : "The selected role contains permissions exceeding your current scope.",
        correlationId,
      };

    case "WEBPHONE_CONFIG_INCOMPLETE":
      return {
        code,
        message: isAr
          ? "يرجى إكمال رقم الامتداد، اسم مستخدم SIP، وكلمة المرور عند تفعيل الهاتف."
          : "Extension, SIP username, and SIP password are required when phone is enabled.",
        correlationId,
      };

    case "WEBPHONE_EXTENSION_TAKEN": {
      const msg = isAr
        ? "رقم الامتداد هذا مستخدم بالفعل."
        : "This SIP extension is already in use.";
      fieldErrors.extension = msg;
      return {
        code,
        message: msg,
        fieldErrors,
        correlationId,
      };
    }

    case "WEBPHONE_SIP_USERNAME_TAKEN": {
      const msg = isAr
        ? "اسم مستخدم SIP هذا مستخدم بالفعل."
        : "This SIP username is already in use.";
      fieldErrors.sipUsername = msg;
      return {
        code,
        message: msg,
        fieldErrors,
        correlationId,
      };
    }

    case "GW.IDEM.MISSING":
    case "GW.IDEM.BAD_VALUE":
    case "GW.IDEM.IN_FLIGHT":
    case "GW.IDEM.MISMATCH":
      return {
        code,
        message: isAr
          ? "خطأ في الاتصال بالبوابة (مفتاح التكرار). يرجى المحاولة مرة أخرى."
          : `Gateway Idempotency issue (${code}). Please retry the action.`,
        correlationId,
      };

    default:
      return {
        code,
        message: serverMsg || (isAr ? `خطأ النظام (${code})` : `System Error (${code})`),
        correlationId,
      };
  }
}
