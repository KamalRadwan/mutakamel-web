"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/components/ui/ToastContext";
import {
  FormDrawer,
  Field,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  Button,
  AmbiguousOutcomePanel,
} from "@/design-system";
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

export function InviteUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
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
          toast.error(lang === "ar" ? "تعذر تحميل الأدوار" : "Failed to load roles");
        }
      } finally {
        setIsLoadingRoles(false);
      }
    }
    loadRolesData();
  }, [lang, toast]);

  const handleSubmit = async (e?: React.FormEvent) => {
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
      toast.error(
        lang === "ar" ? "الطلب غير مطابق" : "Request changed",
        lang === "ar"
          ? "أعد القيم الأصلية لإعادة المحاولة."
          : "Restore the original values before retrying the unresolved invitation.",
      );
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

      toast.success(
        lang === "ar" ? "تمت الدعوة بنجاح" : "Invitation Sent",
        lang === "ar"
          ? "تم إرسال دعوة الانضمام للمشرف الجديد بنجاح."
          : "The invitation email has been sent successfully.",
      );

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
        toast.success(
          lang === "ar" ? "تم تأكيد الدعوة" : "Invitation confirmed",
          lang === "ar"
            ? "أكدت قراءة المستخدم أن الدعوة حفظت بنجاح."
            : "An authoritative user read confirmed the invitation was saved.",
        );
        onSuccess();
        onClose();
        return;
      }

      const details = getErrorMessageAndDetails(err, lang);
      if (details.fieldErrors) {
        setFieldErrors(details.fieldErrors);
      }
      if (!ambiguous && (!details.fieldErrors || Object.keys(details.fieldErrors).length === 0)) {
        toast.error(lang === "ar" ? "فشل إرسال الدعوة" : "Invitation Failed", details.message);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAr = lang === "ar";
  const isDirty = Boolean(email.trim() || firstName.trim() || lastName.trim() || roleId);

  return (
    <FormDrawer
      isOpen
      onClose={onClose}
      titleEn={t.users.inviteTitle}
      titleAr={t.users.inviteTitle}
      subtitleEn={t.users.inviteSubtitle}
      subtitleAr={t.users.inviteSubtitle}
      isSubmitting={isSubmitting || isAmbiguous}
      isDirty={isDirty}
      footerActions={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting || isAmbiguous}>
            {isAr ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            type="submit"
            form="invite-user-form"
            variant="primary"
            loading={isSubmitting}
            disabled={
              rolesForbidden || !email.trim() || !firstName.trim() || !lastName.trim() || !roleId
            }
          >
            {isSubmitting ? t.users.sendingInvite : t.users.sendInvite}
          </Button>
        </>
      }
    >
      <form id="invite-user-form" onSubmit={handleSubmit} className="space-y-4 py-1">
        <div className="rounded-md border border-warn-200 bg-warn-50 p-3 text-xs leading-relaxed text-warn-800 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-300">
          {t.users.invitedInfoBanner}
        </div>

        {isAmbiguous && (
          <AmbiguousOutcomePanel
            idempotencyKey={idempotencyKey}
            message={
              isAr
                ? "نتيجة الدعوة غير مؤكدة. أعد محاولة نفس الطلب."
                : "The invitation outcome is unconfirmed. Retry the exact unchanged request."
            }
            onRetryExact={() => void handleSubmit()}
            retrying={isSubmitting}
          />
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label={t.users.firstNameLabel} required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                maxLength={80}
                value={firstName}
                disabled={isAmbiguous}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={isAr ? "عمر" : "Omar"}
              />
            )}
          </Field>
          <Field label={t.users.lastNameLabel} required>
            {(fieldProps) => (
              <Input
                {...fieldProps}
                maxLength={80}
                value={lastName}
                disabled={isAmbiguous}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={isAr ? "حسين" : "Hassan"}
              />
            )}
          </Field>
        </div>

        <Field label={t.users.emailLabel} required error={fieldErrors.email || undefined}>
          {(fieldProps) => (
            <Input
              {...fieldProps}
              type="email"
              maxLength={255}
              value={email}
              disabled={isAmbiguous}
              onChange={(e) => {
                setEmail(e.target.value);
                setFieldErrors((prev) => ({ ...prev, email: "" }));
              }}
              placeholder="ops.manager@mutakamel.ai"
            />
          )}
        </Field>

        <Field label={t.users.roleLabel} required>

          {(fieldProps) =>
            rolesForbidden ? (
              <div className="flex items-center gap-2 rounded-md border border-warn-200 bg-warn-50 p-2.5 text-xs text-warn-700 dark:border-warn-800/60 dark:bg-warn-950/30 dark:text-warn-400">
                <ShieldAlert className="size-4 shrink-0" />
                <span>{t.users.rolesUnavailable}</span>
              </div>
            ) : (
              <Select value={roleId} onValueChange={setRoleId} disabled={isLoadingRoles || isAmbiguous}>
                <SelectTrigger {...fieldProps}>
                  <SelectValue placeholder={isAr ? "اختر الدور" : "Select a role"} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nameI18n?.[lang] || r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          }
        </Field>

        {user?.isSuperAdmin && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-card p-3 text-xs font-semibold text-foreground">
            <Checkbox
              checked={isSuperAdmin}
              disabled={isAmbiguous}
              onCheckedChange={(c) => setIsSuperAdmin(c === true)}
              className="mt-0.5"
            />
            <span className="flex flex-col gap-0.5">
              <span>{t.users.superAdminCheckbox}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {isAr
                  ? "يتجاوز جميع قيود الصلاحيات النظامية."
                  : "Bypasses all permission checks authoritative backend logic."}
              </span>
            </span>
          </label>
        )}
      </form>
    </FormDrawer>
  );
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
