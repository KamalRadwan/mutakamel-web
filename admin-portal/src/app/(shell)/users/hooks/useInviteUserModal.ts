import { useEffect, useRef, useState, type FormEvent } from "react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/ToastContext";
import {
  inviteAdminUser,
  isForbiddenError,
  listAdminUsers,
  listRoles,
} from "../api/adminUsersApi";
import { getErrorMessageAndDetails } from "../utils/errorMapping";
import {
  claimAdminUserWriteIntent,
  settleAdminUserWriteIntent,
  type AdminUserWriteIntent,
} from "../model/writeIntent";
import { normalizeApiError } from "@/shared/api/normalized-api-error";
import type { AdminRole, CreateAdminUserDto } from "../types";

interface UseInviteUserModalOptions {
  onClose: () => void;
  onSuccess: () => void;
}

export function useInviteUserModal({ onClose, onSuccess }: UseInviteUserModalOptions) {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const toast = useToast();

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAmbiguous, setIsAmbiguous] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState<string | undefined>(undefined);
  const inviteIntentRef = useRef<AdminUserWriteIntent<CreateAdminUserDto> | null>(
    null,
  );

  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [isLoadingRoles, setIsLoadingRoles] = useState(true);
  const [rolesForbidden, setRolesForbidden] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadRolesData() {
      try {
        setRolesForbidden(false);
        const res = await listRoles({ page: 1, limit: 100, sortBy: "name", sortDir: "ASC" });
        const items = res?.data;
        if (Array.isArray(items)) {
          setRoles(items);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } else if ((items as any)?.items) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setRoles((items as any).items);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (isForbiddenError(err)) {
          setRolesForbidden(true);
        } else {
          toast.error(t.users.rolesLoadFailed);
        }
      } finally {
        setIsLoadingRoles(false);
      }
    }
    loadRolesData();
  }, [t, toast]);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!email.trim() || !firstName.trim() || !lastName.trim() || !roleId) return;

    const command: CreateAdminUserDto = {
      email: email.trim().toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      roleId,
      isSuperAdmin: user?.isSuperAdmin ? isSuperAdmin : false,
    };
    let intent: AdminUserWriteIntent<CreateAdminUserDto>;
    try {
      intent = claimAdminUserWriteIntent(
        inviteIntentRef.current,
        "POST",
        "/api/admin/core/v1/users",
        command,
      );
    } catch {
      toast.error(t.users.requestChangedTitle, t.users.requestChangedDesc);
      return;
    }
    inviteIntentRef.current = intent;
    setIdempotencyKey(intent.idempotencyKey);

    setIsSubmitting(true);
    setFieldErrors({});

    try {
      await inviteAdminUser(intent.command, intent.idempotencyKey);
      inviteIntentRef.current = null;
      setIsAmbiguous(false);
      setIdempotencyKey(undefined);

      toast.success(t.users.invitationSentTitle, t.users.invitationSentDesc);

      onSuccess();
      onClose();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      const normalized = normalizeApiError(err);
      const nextIntent = settleAdminUserWriteIntent(intent, err, normalized);
      inviteIntentRef.current = nextIntent;
      const ambiguous = nextIntent?.ambiguous === true;
      setIsAmbiguous(ambiguous);

      if (ambiguous && (await invitedUserExists(intent.command))) {
        inviteIntentRef.current = null;
        setIsAmbiguous(false);
        setIdempotencyKey(undefined);
        toast.success(t.users.invitationConfirmedTitle, t.users.invitationConfirmedDesc);
        onSuccess();
        onClose();
        return;
      }

      const details = getErrorMessageAndDetails(err, lang);
      if (details.fieldErrors) {
        setFieldErrors(details.fieldErrors);
      }
      if (!ambiguous && (!details.fieldErrors || Object.keys(details.fieldErrors).length === 0)) {
        toast.error(t.users.invitationFailedTitle, details.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDirty = Boolean(email.trim() || firstName.trim() || lastName.trim() || roleId);

  return {
    email,
    setEmail,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    roleId,
    setRoleId,
    isSuperAdmin,
    setIsSuperAdmin,
    isSubmitting,
    isAmbiguous,
    idempotencyKey,
    roles,
    isLoadingRoles,
    rolesForbidden,
    fieldErrors,
    setFieldErrors,
    isDirty,
    handleSubmit,
  };
}

async function invitedUserExists(command: CreateAdminUserDto): Promise<boolean> {
  try {
    const result = await listAdminUsers({
      page: 1,
      limit: 100,
      search: command.email,
    });
    return result.data.some(
      (candidate) =>
        candidate.email.toLowerCase() === command.email &&
        candidate.firstName === command.firstName &&
        candidate.lastName === command.lastName &&
        candidate.roleId === command.roleId &&
        candidate.isSuperAdmin === Boolean(command.isSuperAdmin),
    );
  } catch {
    return false;
  }
}
