"use client";

import { ShieldAlert } from "lucide-react";
import { useI18n } from "@/i18n/I18nContext";
import { useAuth } from "@/context/AuthContext";
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
import { useInviteUserModal } from "../hooks/useInviteUserModal";

export function InviteUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const {
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
  } = useInviteUserModal({ onClose, onSuccess });

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
            {t.users.cancel}
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
            message={t.users.ambiguousInviteMessage}
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
                placeholder={t.users.firstNamePlaceholder}
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
                placeholder={t.users.lastNamePlaceholder}
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
                  <SelectValue placeholder={t.users.selectRolePlaceholder} />
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
                {t.users.superAdminHint}
              </span>
            </span>
          </label>
        )}
      </form>
    </FormDrawer>
  );
}
