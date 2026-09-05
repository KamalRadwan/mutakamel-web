import { normalizeErrorCode } from "../api/adminUsersApi";
import { en } from "@/i18n/dictionaries/en";
import { ar } from "@/i18n/dictionaries/ar";

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

  const copy = (lang === "ar" ? ar : en).users.errors;
  const fieldErrors: Record<string, string> = {};

  if (!code) {
    return {
      code: null,
      message: serverMsg || copy.unexpected,
      correlationId,
    };
  }

  switch (code) {
    case "MISSING_REQUIRED_PERMISSIONS": {
      const details = data?.details as Record<string, unknown> | undefined;
      const requiredPerms = (details?.permissions as string[] | undefined)?.join(", ");
      return {
        code,
        message: copy.missingPermissions(requiredPerms),
        correlationId,
        isPermissionError: true,
      };
    }

    case "ADMIN_USER_NOT_FOUND":
      return {
        code,
        message: copy.adminUserNotFound,
        correlationId,
        isNotFound: true,
      };

    case "ADMIN_EMAIL_TAKEN": {
      const msg = copy.adminEmailTaken;
      fieldErrors.email = msg;
      return {
        code,
        message: msg,
        fieldErrors,
        correlationId,
      };
    }

    case "ROLE_NOT_FOUND": {
      const msg = copy.roleNotFound;
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
        message: copy.adminSelfForbidden,
        correlationId,
        isSelfForbidden: true,
      };

    case "ADMIN_SELF_ROLE_CHANGE_FORBIDDEN":
      return {
        code,
        message: copy.adminSelfRoleChangeForbidden,
        correlationId,
        isSelfForbidden: true,
      };

    case "ADMIN_LAST_SUPER_ADMIN":
      return {
        code,
        message: copy.adminLastSuperAdmin,
        correlationId,
      };

    case "ADMIN_LAST_ROLE_MANAGER":
      return {
        code,
        message: copy.adminLastRoleManager,
        correlationId,
      };

    case "ADMIN_INVITE_PENDING":
      return {
        code,
        message: copy.adminInvitePending,
        correlationId,
      };

    case "ADMIN_SUPER_ADMIN_REQUIRED":
      return {
        code,
        message: copy.adminSuperAdminRequired,
        correlationId,
      };

    case "ROLE_PERMISSION_ESCALATION":
      return {
        code,
        message: copy.rolePermissionEscalation,
        correlationId,
      };

    case "WEBPHONE_CONFIG_INCOMPLETE":
      return {
        code,
        message: copy.webphoneConfigIncomplete,
        correlationId,
      };

    case "WEBPHONE_EXTENSION_TAKEN": {
      const msg = copy.webphoneExtensionTaken;
      fieldErrors.extension = msg;
      return {
        code,
        message: msg,
        fieldErrors,
        correlationId,
      };
    }

    case "WEBPHONE_SIP_USERNAME_TAKEN": {
      const msg = copy.webphoneSipUsernameTaken;
      fieldErrors.sipUsername = msg;
      return {
        code,
        message: msg,
        fieldErrors,
        correlationId,
      };
    }

    // Both mean the panel's view of the user's extension is stale — it created
    // one that already exists, or edited one that has since been removed.
    case "WEBPHONE_OWNER_HAS_EXTENSION":
      return {
        code,
        message: copy.webphoneOwnerHasExtension,
        correlationId,
      };

    case "WEBPHONE_EXTENSION_NOT_FOUND":
      return {
        code,
        message: copy.webphoneExtensionNotFound,
        correlationId,
      };

    case "GW.IDEM.MISSING":
    case "GW.IDEM.BAD_VALUE":
    case "GW.IDEM.IN_FLIGHT":
    case "GW.IDEM.MISMATCH":
      return {
        code,
        message: copy.gatewayIdempotencyIssue(code),
        correlationId,
      };

    default:
      return {
        code,
        message: serverMsg || copy.systemError(code),
        correlationId,
      };
  }
}
